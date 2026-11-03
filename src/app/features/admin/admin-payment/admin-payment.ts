import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AccountType, PaymentAccount } from '../../../core/models/api.models';
import { Admin } from '../../../core/services/admin';
import { arabicError } from '../../../shared/utils/errors';
import { formatEgyptPhone } from '../../../shared/utils/format';

type Icon = 'bolt' | 'phone' | 'bank' | 'wallet';

const IPA_PATTERN = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/;
const PHONE_PATTERN = /^(\+2|002)?01\d{9}$/;
const BANK_PATTERN = /^[A-Za-z0-9 ]{8,34}$/;

// What each account type accepts (ids come from /api/Payment/AccountTypes):
// 1 InstaPay, 2 e-wallet, 3 bank account
function identifierValid(typeId: number, raw: string): boolean {
  const value = raw.trim();
  const phone = value.replace(/[\s-]/g, '');

  switch (typeId) {
    case 1: return IPA_PATTERN.test(value) || PHONE_PATTERN.test(phone);
    case 2: return PHONE_PATTERN.test(phone);
    case 3: return BANK_PATTERN.test(value);
    default: return value.length >= 3;
  }
}

function identifier(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (!raw) return null; // "required" reports the empty case
  const typeId = Number(control.parent?.get('accountType')?.value ?? 0);
  return identifierValid(typeId, raw) ? null : { identifier: true };
}

@Component({
  selector: 'app-admin-payment',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-payment.html',
  styleUrl: './admin-payment.scss',
})
export class AdminPayment {
  private fb = inject(FormBuilder);
  private admin = inject(Admin);

  typeSelect = viewChild<ElementRef<HTMLSelectElement>>('typeSelect');

  accounts = signal<PaymentAccount[]>([]);
  types = signal<AccountType[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  notice = signal<{ kind: 'success' | 'error'; text: string } | null>(null);

  form = this.fb.nonNullable.group({
    accountType: [0, [Validators.min(1)]],
    accountName: ['', [Validators.required, Validators.maxLength(100)]],
    ipan: ['', [Validators.required, Validators.maxLength(60), identifier]],
    notes: ['', [Validators.maxLength(500)]],
  });

  saving = signal(false);
  saveError = signal<string | null>(null);
  deletingId = signal<number | null>(null);
  copiedId = signal<number | null>(null);

  constructor() {
    // The accepted format depends on the account type, so check again when it changes
    this.form.controls.accountType.valueChanges.subscribe(() =>
      this.form.controls.ipan.updateValueAndValidity()
    );
    this.load();
  }

  load(silent = false) {
    if (!silent) this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      accounts: this.admin.getPaymentAccounts(),
      types: this.admin.getAccountTypes(),
    }).subscribe({
      next: ({ accounts, types }) => {
        this.accounts.set(accounts);
        this.types.set(types);
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(arabicError(err, { 403: 'ليس لديك صلاحية الوصول إلى هذه الصفحة' }));
        this.loading.set(false);
      },
    });
  }

  // ---------- helpers for the template ----------

  iconOf(account: PaymentAccount): Icon {
    switch (account.accountType?.id) {
      case 1: return 'bolt';
      case 2: return 'phone';
      case 3: return 'bank';
      default: return 'wallet';
    }
  }

  // The label above the account number changes with the type
  idLabel(account: PaymentAccount): string {
    switch (account.accountType?.id) {
      case 1: return 'المعرف المالي للتحويل';
      case 2: return 'رقم التليفون / المحفظة';
      case 3: return 'رقم الحساب / الأيبان IBAN';
      default: return 'المعرف المالي';
    }
  }

  // Egyptian phone numbers are shown as +2 01..., anything else as typed
  display(account: PaymentAccount): string {
    return formatEgyptPhone(account.ipan);
  }

  identifierMessage(): string {
    switch (this.form.controls.accountType.value) {
      case 1: return 'أدخل عنوان إنستاباي مثل name@instapay أو رقم هاتف مصري صحيح';
      case 2: return 'أدخل رقم هاتف مصري صحيح (يبدأ بـ 01)';
      case 3: return 'أدخل رقم حساب أو IBAN صحيحًا (أحرف وأرقام فقط)';
      default: return 'القيمة المدخلة غير صالحة';
    }
  }

  // The "إضافة حساب جديد" button at the top: jump to the form
  focusForm() {
    const select = this.typeSelect()?.nativeElement;
    select?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    select?.focus();
  }

  async copy(account: PaymentAccount) {
    try {
      await navigator.clipboard.writeText(this.display(account));
      this.copiedId.set(account.id);
      setTimeout(() => this.copiedId.set(null), 2000);
    } catch {
      // clipboard can be blocked, the text can still be selected by hand
    }
  }

  // ---------- actions ----------

  add() {
    this.form.controls.ipan.updateValueAndValidity();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.saveError.set(null);

    this.admin
      .addPaymentAccount({
        accountType: v.accountType,
        ipan: v.ipan.trim(),
        accountName: v.accountName.trim(),
        notes: v.notes.trim(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.cancel();
          this.notice.set({ kind: 'success', text: 'تمت إضافة حساب الدفع بنجاح.' });
          this.load(true); // read the saved list back from the server
        },
        error: err => {
          this.saveError.set(
            arabicError(err, {
              400: 'تعذر إضافة الحساب، تأكد من صحة البيانات المدخلة وحاول مرة أخرى.',
              403: 'ليس لديك صلاحية لإضافة حسابات الدفع.',
            })
          );
          this.saving.set(false);
        },
      });
  }

  // "إلغاء وتفريغ الحقول"
  cancel() {
    this.form.reset({ accountType: 0, accountName: '', ipan: '', notes: '' });
    this.saveError.set(null);
  }

  remove(account: PaymentAccount) {
    if (this.deletingId() !== null) return;
    if (!confirm(`سيتم حذف حساب «${account.accountName}» من حسابات الدفع التي تظهر للعملاء. هل تريد المتابعة؟`)) return;

    this.deletingId.set(account.id);
    this.notice.set(null);

    this.admin.deletePaymentAccount(account.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.notice.set({ kind: 'success', text: 'تم حذف الحساب.' });
        this.load(true);
      },
      error: err => {
        this.deletingId.set(null);
        this.notice.set({
          kind: 'error',
          text: arabicError(err, {
            403: 'ليس لديك صلاحية لحذف حسابات الدفع.',
            404: 'الحساب غير موجود أو تم حذفه من قبل.',
          }),
        });
      },
    });
  }
}