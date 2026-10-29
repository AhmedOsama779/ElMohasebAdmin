import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CategoryItem } from '../../../core/models/api.models';
import { Admin } from '../../../core/services/admin';
import { Category } from '../../../core/services/category';
import { arabicError } from '../../../shared/utils/errors';
import { toProxyUrl } from '../../../shared/utils/url';

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// The deposit is the first payment, so it can't be more than the full price
function depositWithinPrice(group: AbstractControl): ValidationErrors | null {
  const price = group.get('price')?.value;
  const deposit = group.get('deposit')?.value;
  return price != null && deposit != null && deposit > price ? { depositTooHigh: true } : null;
}

// The server rejects two documents with the same name in one service
function uniqueNames(array: AbstractControl): ValidationErrors | null {
  const names = (array as FormArray).controls
    .map(c => String(c.get('name')?.value ?? '').trim().toLowerCase())
    .filter(Boolean);
  return new Set(names).size === names.length ? null : { duplicate: true };
}

@Component({
  selector: 'app-admin-services',
  imports: [DecimalPipe, ReactiveFormsModule],
  templateUrl: './admin-services.html',
  styleUrl: './admin-services.scss',
})
export class AdminServices {
  private fb = inject(FormBuilder);
  private admin = inject(Admin);
  private categoryApi = inject(Category);

  toProxyUrl = toProxyUrl;
  dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  // ---------- the list ----------
  categories = signal<CategoryItem[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  notice = signal<{ kind: 'success' | 'warning'; text: string } | null>(null);

  filterId = signal(0); // 0 = all categories
  total = computed(() => this.categories().reduce((n, c) => n + c.services.length, 0));
  groups = computed(() =>
    this.categories().filter(c => c.services.length && (this.filterId() === 0 || c.id === this.filterId()))
  );

  // ---------- the form inside the dialog ----------
  documents = new FormArray<FormGroup>([], { validators: uniqueNames });

  form = this.fb.nonNullable.group(
    {
      categoryId: [0, [Validators.min(1)]],
      name: ['', [Validators.required, Validators.maxLength(150)]],
      price: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
      deposit: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
      description: ['', [Validators.required]],
      documents: this.documents,
    },
    { validators: depositWithinPrice }
  );

  image = signal<File | null>(null);
  preview = signal<string | null>(null);
  imageError = signal<string | null>(null);

  saving = signal(false);
  saveError = signal<string | null>(null);

  // Shows "المتبقي" under the deposit field
  private price = toSignal(this.form.controls.price.valueChanges, { initialValue: null as number | null });
  private deposit = toSignal(this.form.controls.deposit.valueChanges, { initialValue: null as number | null });
  remaining = computed(() => {
    const p = this.price();
    const d = this.deposit();
    return p != null && d != null && d <= p ? p - d : null;
  });

  constructor() {
    this.load();
  }

  // ---------- list helpers ----------
  load() {
    this.loading.set(true);
    this.error.set(null);

    this.categoryApi.getAll(1, 50).subscribe({
      next: page => {
        this.categories.set(page.items);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(arabicError(err, { 403: 'ليس لديك صلاحية الوصول إلى هذه الصفحة' }));
        this.loading.set(false);
      },
    });
  }

  onFilter(event: Event) {
    this.filterId.set(Number((event.target as HTMLSelectElement).value));
  }

  servicesLabel(n: number): string {
    return n === 1 ? '1 خدمة' : `${n} خدمات`;
  }

  docsLabel(n: number): string {
    return n === 0 ? 'بدون مستندات' : n === 1 ? '1 مستند' : `${n} مستندات`;
  }

  // True when a field was touched and is invalid (works for any control or group)
  bad(group: AbstractControl, name: string): boolean {
    const control = group.get(name);
    return !!control && control.invalid && control.touched;
  }

  // ---------- dialog ----------
  openDialog() {
    this.notice.set(null);
    this.resetForm();
    this.dialog()?.nativeElement.showModal();
  }

  requestClose() {
    if (this.saving()) return;
    if (this.form.dirty && !confirm('سيتم تجاهل البيانات التي أدخلتها. هل تريد الإغلاق؟')) return;
    this.closeDialog();
  }

  // The Esc key: ask first instead of closing straight away
  onCancelEvent(event: Event) {
    event.preventDefault();
    this.requestClose();
  }

  // A click on the dimmed area around the panel lands on the <dialog> element itself
  onDialogClick(event: MouseEvent) {
    if (event.target === this.dialog()?.nativeElement) this.requestClose();
  }

  addDocument() {
    this.documents.push(
      this.fb.nonNullable.group({
        name: ['', [Validators.required, Validators.maxLength(150)]],
        isMandatory: [true],
      })
    );
    this.form.markAsDirty();
  }

  removeDocument(index: number) {
    this.documents.removeAt(index);
    this.form.markAsDirty();
  }

  onImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so the same file can be chosen again
    if (!file) return;

    if (!IMAGE_TYPES.includes(file.type)) {
      this.imageError.set('نوع الصورة غير مدعوم، المسموح JPG أو PNG فقط');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.imageError.set('حجم الصورة أكبر من 5 ميجابايت');
      return;
    }

    this.imageError.set(null);
    this.setImage(file);
    this.form.markAsDirty();
  }

  removeImage() {
    this.setImage(null);
    this.imageError.set(null);
  }

  // ---------- saving ----------
  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const name = v.name.trim();
    const docs = (v.documents as { name: string; isMandatory: boolean }[]).map(d => ({
      name: d.name.trim(),
      isMandatory: d.isMandatory,
    }));

    this.saving.set(true);
    this.saveError.set(null);

    this.admin
      .createService({
        categoryId: v.categoryId,
        name,
        description: v.description.trim(),
        price: v.price!,
        deposit: v.deposit!,
        thumbnail: this.image(),
      })
      .subscribe({
        next: () => this.afterCreate(v.categoryId, name, docs),
        error: err => {
          this.saveError.set(
            arabicError(err, {
              400: 'تعذر إنشاء الخدمة. قد يكون اسم الخدمة مستخدمًا من قبل أو بعض البيانات غير صالحة.',
              403: 'ليس لديك صلاحية لإضافة خدمات.',
            })
          );
          this.saving.set(false);
        },
      });
  }

  // The server does not return the id of the new service, so we find it by name
  // in a fresh categories list, then add the documents one by one
  private afterCreate(categoryId: number, name: string, docs: { name: string; isMandatory: boolean }[]) {
    this.categoryApi.getAll(1, 50).subscribe({
      next: page => {
        this.categories.set(page.items);

        if (!docs.length) {
          this.finish([]);
          return;
        }

        const serviceId = this.findServiceId(page.items, categoryId, name);
        if (!serviceId) {
          this.finish(docs.map(d => d.name));
          return;
        }

        forkJoin(
          docs.map(d =>
            this.admin.addDocument(serviceId, d.name, d.isMandatory).pipe(
              map(() => null),
              catchError(() => of(d.name)) // remember which one failed, keep going
            )
          )
        ).subscribe(results => this.finish(results.filter((n): n is string => n !== null)));
      },
      error: () => {
        this.finish(docs.map(d => d.name));
        this.load();
      },
    });
  }

  private finish(failedDocuments: string[]) {
    this.saving.set(false);
    this.form.markAsPristine();
    this.closeDialog();

    this.notice.set(
      failedDocuments.length
        ? { kind: 'warning', text: `تمت إضافة الخدمة، لكن تعذرت إضافة هذه المستندات: ${failedDocuments.join('، ')}` }
        : { kind: 'success', text: 'تمت إضافة الخدمة بنجاح.' }
    );
  }

  private findServiceId(categories: CategoryItem[], categoryId: number, name: string): number | null {
    const category = categories.find(c => c.id === categoryId);
    return category?.services.find(s => s.name.trim() === name)?.id ?? null;
  }

  private closeDialog() {
    this.dialog()?.nativeElement.close();
    this.setImage(null);
  }

  private resetForm() {
    this.form.reset({ categoryId: this.filterId(), name: '', price: null, deposit: null, description: '' });
    this.documents.clear();
    this.addDocument();
    this.form.markAsPristine();
    this.setImage(null);
    this.imageError.set(null);
    this.saveError.set(null);
    this.saving.set(false);
  }

  private setImage(file: File | null) {
    const old = this.preview();
    if (old) URL.revokeObjectURL(old);
    this.image.set(file);
    this.preview.set(file ? URL.createObjectURL(file) : null);
  }
}