import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoryItem } from '../../../core/models/api.models';
import { Admin } from '../../../core/services/admin';
import { Category } from '../../../core/services/category';
import { arabicError } from '../../../shared/utils/errors';
import { toProxyUrl } from '../../../shared/utils/url';

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-admin-categories',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-categories.html',
  styleUrl: './admin-categories.scss',
})
export class AdminCategories {
  private fb = inject(FormBuilder);
  private admin = inject(Admin);
  private categoryApi = inject(Category);

  toProxyUrl = toProxyUrl;
  nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  // ---------- the list ----------
  categories = signal<CategoryItem[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  notice = signal<{ kind: 'success' | 'error'; text: string } | null>(null);
  busyId = signal<number | null>(null);

  // ---------- the add form ----------
  form = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(100),
        (c: AbstractControl) => (this.isDuplicate(String(c.value ?? '')) ? { duplicate: true } : null),
      ],
    ],
  });

  image = signal<File | null>(null);
  preview = signal<string | null>(null);
  imageError = signal<string | null>(null);
  imageTouched = signal(false);

  saving = signal(false);
  saveError = signal<string | null>(null);

  constructor() {
    this.load();
  }

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

  isActive(category: CategoryItem): boolean {
    return this.admin.isCategoryActive(category);
  }

  servicesLabel(n: number): string {
    return n === 0 ? 'بدون خدمات' : n === 1 ? '1 خدمة' : `${n} خدمات`;
  }

  toggle(category: CategoryItem) {
    const next = !this.isActive(category);

    if (!next && !confirm(`سيتم تعطيل تصنيف «${category.name}» وإخفاؤه عن العملاء. هل تريد المتابعة؟`)) {
      return;
    }

    this.busyId.set(category.id);
    this.notice.set(null);

    this.admin.setCategoryActive(category.id, next).subscribe({
      next: () => {
        this.categories.update(list =>
          list.map(c => (c.id === category.id ? { ...c, isActive: next } : c))
        );
        this.busyId.set(null);
      },
      error: err => {
        this.notice.set({
          kind: 'error',
          text: arabicError(err, {
            403: 'ليس لديك صلاحية لتغيير حالة التصنيف.',
            404: 'هذه الميزة غير متاحة بعد في الخادم.',
          }),
        });
        this.busyId.set(null);
      },
    });
  }

  // The "إضافة تصنيف جديد" button at the top: jump to the form
  focusForm() {
    const input = this.nameInput()?.nativeElement;
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus();
  }

  onImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so the same file can be chosen again
    this.imageTouched.set(true);
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
  }

  save() {
    this.imageTouched.set(true);
    this.form.controls.name.updateValueAndValidity(); // the list may have loaded after the last keystroke

    const file = this.image();
    if (this.form.invalid || !file) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);

    this.admin.createCategory(this.form.controls.name.value.trim(), file).subscribe({
      next: () => {
        this.saving.set(false);
        this.reset();
        this.notice.set({ kind: 'success', text: 'تمت إضافة التصنيف بنجاح.' });
        this.load();
      },
      error: err => {
        this.saveError.set(
          arabicError(err, {
            400: 'تعذر إضافة التصنيف. قد يكون الاسم مستخدمًا من قبل أو الصورة غير صالحة.',
            403: 'ليس لديك صلاحية لإضافة تصنيفات.',
          })
        );
        this.saving.set(false);
      },
    });
  }

  // "إلغاء"
  reset() {
    this.form.reset({ name: '' });
    this.setImage(null);
    this.imageError.set(null);
    this.imageTouched.set(false);
    this.saveError.set(null);
  }

  private isDuplicate(value: string): boolean {
    const name = value.trim().toLowerCase();
    return !!name && this.categories().some(c => c.name.trim().toLowerCase() === name);
  }

  private setImage(file: File | null) {
    const old = this.preview();
    if (old) URL.revokeObjectURL(old);
    this.image.set(file);
    this.preview.set(file ? URL.createObjectURL(file) : null);
  }
}