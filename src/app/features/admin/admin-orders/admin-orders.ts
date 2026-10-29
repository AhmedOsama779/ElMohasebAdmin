import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminRequest, PagedResult } from '../../../core/models/api.models';
import { Admin } from '../../../core/services/admin';
import { arabicError } from '../../../shared/utils/errors';

type Filter = 'all' | 'white' | 'black';

@Component({
  selector: 'app-admin-orders',
  imports: [RouterLink],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.scss',
})
export class AdminOrders {
  private admin = inject(Admin);
  private router = inject(Router);
  private latestRequest = 0;

  readonly pageSize = 10;

  filter = signal<Filter>('all');
  pageNumber = signal(1);

  data = signal<PagedResult<AdminRequest> | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  items = computed(() => this.data()?.items ?? []);

  // Up to 5 page numbers around the current page
  pages = computed(() => {
    const d = this.data();
    if (!d) return [];
    const start = Math.max(1, Math.min(d.pageNumber - 2, d.totalPages - 4));
    const end = Math.min(d.totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

  constructor() {
    this.load();
  }

  setFilter(filter: Filter) {
    if (filter === this.filter()) return;
    this.filter.set(filter);
    this.pageNumber.set(1);
    this.load();
  }

  goTo(page: number) {
    const total = this.data()?.totalPages ?? 1;
    if (page < 1 || page > total || page === this.pageNumber()) return;
    this.pageNumber.set(page);
    this.load();
  }

  initial(name: string): string {
    return name.trim().charAt(0);
  }

  // Opens the full order page (not a side panel)
  open(order: AdminRequest) {
    this.router.navigate(['/admin/orders', order.id]);
  }

  private load() {
    const id = ++this.latestRequest;
    this.loading.set(true);
    this.error.set(null);

    const f = this.filter();
    const isSpam = f === 'all' ? undefined : f === 'black';

    this.admin.getRequests(this.pageNumber(), this.pageSize, isSpam).subscribe({
      next: res => {
        if (id !== this.latestRequest) return; // a newer request replaced this one
        this.data.set(res);
        this.loading.set(false);
      },
      error: err => {
        if (id !== this.latestRequest) return;
        this.error.set(arabicError(err, { 403: 'ليس لديك صلاحية الوصول إلى هذه الصفحة' }));
        this.loading.set(false);
      },
    });
  }
}