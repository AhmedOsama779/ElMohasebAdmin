import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminRequest, RequestDocument } from '../../../core/models/api.models';
import { Admin } from '../../../core/services/admin';
import { arabicError } from '../../../shared/utils/errors';
import { toProxyUrl } from '../../../shared/utils/url';


type Kind = 'pdf' | 'image' | 'file';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const MIME_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

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

  request = signal<AdminRequest | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  // The file being fetched right now (preview or download)
  busyFile = signal<string | null>(null);
  fileError = signal<string | null>(null);

  // "إجمالي 4 ملفات مرفقة"
  filesLabel = computed(() => {
    const n = this.request()?.documents?.length ?? 0;
    if (n === 0) return 'لا توجد ملفات مرفقة';
    if (n === 1) return 'إجمالي ملف واحد مرفق';
    if (n === 2) return 'إجمالي ملفين مرفقين';
    return n <= 10 ? `إجمالي ${n} ملفات مرفقة` : `إجمالي ${n} ملفًا مرفقًا`;
  });

  constructor() {
    this.admin.findRequest(this.id).subscribe({
      next: request => {
        if (!request) {
          this.error.set('لم يتم العثور على هذا الطلب');
        } else {
          this.request.set(request);
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

  // "pdf" from "السجل التجاري.pdf", or from the end of the link when the name has no extension
  extensionOf(doc: RequestDocument): string {
    const fromName = /\.([a-z0-9]{2,5})$/i.exec(doc.name)?.[1];
    const fromUrl = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(doc.url)?.[1];
    return (fromName ?? fromUrl ?? '').toLowerCase();
  }

  kindOf(doc: RequestDocument): Kind {
    const extension = this.extensionOf(doc);
    if (extension === 'pdf') return 'pdf';
    return IMAGE_EXTENSIONS.includes(extension) ? 'image' : 'file';
  }

  // "صيغة: PDF" or "صيغة: صورة PNG"
  formatLabel(doc: RequestDocument): string {
    const extension = this.extensionOf(doc).toUpperCase();
    const kind = this.kindOf(doc);
    if (kind === 'image') return extension ? `صورة ${extension}` : 'صورة';
    return extension || 'ملف';
  }

  preview(doc: RequestDocument) {
    if (this.busyFile() !== null) return;

    // Open the tab right away, inside the click, otherwise the browser blocks it as a pop-up
    const tab = window.open('', '_blank');

    this.fetch(doc, blob => {
      const href = URL.createObjectURL(blob);
      if (tab) tab.location.href = href;
      else window.open(href, '_blank');
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    }, () => tab?.close());
  }

  download(doc: RequestDocument) {
    if (this.busyFile() !== null) return;

    this.fetch(doc, blob => {
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = this.fileNameFor(doc, blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    });
  }

  // Make sure the saved file has an extension, even if the document name has none
  private fileNameFor(doc: RequestDocument, blob: Blob): string {
    if (/\.[a-z0-9]{2,5}$/i.test(doc.name)) return doc.name;
    const extension = this.extensionOf(doc) || MIME_EXTENSION[blob.type] || '';
    return extension ? `${doc.name}.${extension}` : doc.name;
  }

  private fetch(doc: RequestDocument, done: (blob: Blob) => void, failed?: () => void) {
    this.busyFile.set(doc.url);
    this.fileError.set(null);

    this.admin.fetchFile(doc.url).subscribe({
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