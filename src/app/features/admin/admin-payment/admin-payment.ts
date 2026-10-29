import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Admin } from '../../../core/services/admin';
import { Catalog } from '../../../core/services/catalog';
import { arabicError } from '../../../shared/utils/errors';

// Accepts an InstaPay address (name@instapay) or an Egyptian phone number
const IPA_PATTERN = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/;
const PHONE_PATTERN = /^(\+2|002)?01\d{9}$/;

function instapayTarget(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (!raw) return null; // "required" reports the empty case
  const phone = raw.replace(/[\s-]/g, '');
  return IPA_PATTERN.test(raw) || PHONE_PATTERN.test(phone) ? null : { instapay: true };
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
  private catalog = inject(Catalog);

  loading = signal(true);
  loadError = signal<string | null>(null);
  isNew = signal(false); // no payment info has been saved yet

  saving = signal(false);
  saved = signal(false);
  saveError = signal<string | null>(null);

  // The length limits are our guess until the backend confirms its own
  form = this.fb.nonNullable.group({
    ipan: ['', [Validators.required, instapayTarget]],
    accountName: ['', [Validators.required, Validators.maxLength(100)]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  get ipan() { return this.form.controls.ipan; }
  get accountName() { return this.form.controls.accountName; }
  get notes() { return this.form.controls.notes; }

  constructor() {
    // Hide the "saved" message as soon as the admin edits something again
    this.form.valueChanges.subscribe(() => this.saved.set(false));

    this.catalog.getPaymentInfo().subscribe({
      next: info => {
        this.form.reset({
          ipan: info.ipan ?? '',
          accountName: info.accountName ?? '',
          notes: info.notes ?? '',
        });
        this.loading.set(false);
      },
      error: err => {
        if (err.status === 404) this.isNew.set(true); // first time: the form starts empty
        else this.loadError.set(arabicError(err));
        this.loading.set(false);
      },
    });
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set(null);

    this.admin
      .savePayment({
        ipan: value.ipan.trim(),
        accountName: value.accountName.trim(),
        notes: value.notes.trim(),
      })
      .subscribe({
        next: () => {
          this.form.markAsPristine();
          this.isNew.set(false);
          this.saved.set(true);
          this.saving.set(false);
        },
        error: err => {
          this.saveError.set(
            arabicError(err, {
              400: 'تعذر حفظ البيانات، تأكد من صحة الحقول المدخلة وحاول مرة أخرى.',
              403: 'ليس لديك صلاحية لتعديل إعدادات الدفع.',
            })
          );
          this.saving.set(false);
        },
      });
  }
}