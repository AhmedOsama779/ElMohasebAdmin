import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminRequest, RequestDocumentFile, RequestExtras } from '../../../core/models/api.models';
import { Admin } from '../../../core/services/admin';
import { arabicError } from '../../../shared/utils/errors';
import { formatDate } from '../../../shared/utils/format';
import { toProxyUrl } from '../../../shared/utils/url';

@Component({
  selector: 'app-admin-order-details',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './admin-order-details.html',
  styleUrl: './admin-order-details.scss',
})
export class AdminOrderDetails {
  private route = inject(ActivatedRoute);
  private admin = inject(Admin);

  private id = Number(this.route.snapshot.paramMap.get('id'));
  toProxyUrl = toProxyUrl;
  formatDate = formatDate;

  request = signal<AdminRequest | null>(null);
  extras = signal<RequestExtras | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  // The file being fetched right now (preview or download)
  busyFile = signal<number | null>(null);
  fileError = signal<string | null>(null);

  // What to show where the second receipt would be
  remainingNote = computed(() => {
    const e = this.extras();
    if (!e) return 'إيصال المتبقي غير متاح حاليًا';
    if (!e.isPaidComplete) return 'لم يتم سداد المتبقي بعد';
    return e.remainingReceiptUrl ? null : 'لا توجد صورة لإيصال المتبقي';
  });

  // "إجمالي 4 ملفات مرفقة"
  filesLabel = computed(() => {
    const n = this.extras()?.documents.length ?? 0;
    if (n === 0) return 'لا توجد ملفات مرفقة';
    if (n === 1) return 'إجمالي ملف واحد مرفق';
    if (n === 2) return 'إجمالي ملفين مرفقين';
    return n <= 10 ? `إجمالي ${n} ملفات مرفقة` : `إجمالي ${n} ملفًا مرفقًا`;
  });

  constructor() {
    forkJoin({
      request: this.admin.findRequest(this.id),
      extras: this.admin.getRequestExtras(this.id),
    }).subscribe({
      next: ({ request, extras }) => {
        if (!request) {
          this.error.set('لم يتم العثور على هذا الطلب');
        } else {
          this.request.set(request);
          this.extras.set(extras);
          if (!request.isRead) this.markRead(request); // opening an order counts as reading it
        }
        this.loading.set(false);
      },
      error: err => {
        this.error.set(arabicError(err, { 403: 'ليس لديك صلاحية الوصول إلى هذه الصفحة' }));
        this.loading.set(false);
      },
    });
  }

  // ---------- file helpers ----------

  // "صيغة: PDF" or "صيغة: صورة PNG"
  formatLabel(file: RequestDocumentFile): string {
    const extension = file.name.includes('.') ? file.name.split('.').pop()!.toUpperCase() : '';
    if (file.kind === 'pdf') return extension || 'PDF';
    return extension ? `صورة ${extension}` : 'صورة';
  }

  // "2.4 ميجابايت" (or kilobytes for small files)
  sizeLabel(bytes: number | null): string {
    if (bytes == null) return '—';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} ميجابايت` : `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`;
  }

  preview(file: RequestDocumentFile) {
    if (!this.canFetch(file)) return;

    // Open the tab right away, inside the click, otherwise the browser blocks it as a pop-up
    const tab = window.open('', '_blank');

    this.fetch(file, blob => {
      const href = URL.createObjectURL(blob);
      if (tab) tab.location.href = href;
      else window.open(href, '_blank');
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    }, () => tab?.close());
  }

  download(file: RequestDocumentFile) {
    if (!this.canFetch(file)) return;

    this.fetch(file, blob => {
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    });
  }

  private canFetch(file: RequestDocumentFile): boolean {
    if (this.busyFile() !== null) return false;
    if (!file.url) {
      this.fileError.set('رابط هذا الملف غير متاح حاليًا.');
      return false;
    }
    return true;
  }

  private fetch(file: RequestDocumentFile, done: (blob: Blob) => void, failed?: () => void) {
    this.busyFile.set(file.id);
    this.fileError.set(null);

    this.admin.fetchFile(file.url!).subscribe({
      next: blob => {
        done(blob);
        this.busyFile.set(null);
      },
      error: err => {
        failed?.();
        this.fileError.set(
          arabicError(err, {
            403: 'ليس لديك صلاحية لفتح هذا الملف.',
            404: 'تعذر العثور على الملف.',
          })
        );
        this.busyFile.set(null);
      },
    });
  }

  private markRead(request: AdminRequest) {
    this.admin.markRead(request.id, request.code).subscribe({ error: () => {} }); // best effort
  }
}