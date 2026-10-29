import { Component, computed, inject, signal } from '@angular/core';
import { Customer, PagedResult } from '../../../core/models/api.models';
import { CustomersApi } from '../../../core/services/customers-api';
import { arabicError } from '../../../shared/utils/errors';

type Filter = 'all' | 'white' | 'black';
type Kind = 'block' | 'unblock' | 'role';

const AVATAR_COLORS = [
  { bg: '#dbeafe', fg: '#1e40af' },
  { bg: '#fce7f3', fg: '#9d174d' },
  { bg: '#dcfce7', fg: '#166534' },
  { bg: '#fef3c7', fg: '#92400e' },
  { bg: '#ede9fe', fg: '#5b21b6' },
];

@Component({
  selector: 'app-admin-customers',
  templateUrl: './admin-customers.html',
  styleUrl: './admin-customers.scss',
  host: { '(document:keydown.escape)': 'cancel()' },
})
export class AdminCustomers {
  private api = inject(CustomersApi);
  private latestRequest = 0;

  readonly pageSize = 10;

  filter = signal<Filter>('all');
  pageNumber = signal(1);

  data = signal<PagedResult<Customer> | null>(null);
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

  // The action waiting for the admin's confirmation
  pending = signal<{ kind: Kind; customer: Customer } | null>(null);
  working = signal(false);
  actionError = signal<string | null>(null);

  confirmText = computed(() => {
    const p = this.pending();
    if (!p) return null;
    const name = p.customer.fullName;

    switch (p.kind) {
      case 'block':
        return {
          title: 'حظر العميل',
          body: `سيتم نقل جميع طلبات ${name} إلى طلبات القائمة السوداء واستبعادها من قائمة الطلبات العامة.`,
          button: 'تأكيد الحظر',
          danger: true,
        };
      case 'unblock':
        return {
          title: 'إلغاء حظر العميل',
          body: `سيعود ${name} إلى القائمة البيضاء وستظهر طلباته في قائمة الطلبات العامة.`,
          button: 'تأكيد إلغاء الحظر',
          danger: false,
        };
      case 'role': {
        const toAdmin = p.customer.role !== 'Admin';
        return {
          title: 'تغيير الدور',
          body: toAdmin
            ? `سيصبح ${name} مديرًا ولديه صلاحية الوصول إلى بوابة الإدارة، وتسري الصلاحية عند تسجيل دخوله التالي.`
            : `سيتحول ${name} إلى مستخدم عادي وتُسحب منه صلاحيات الإدارة عند تسجيل دخوله التالي.`,
          button: 'تأكيد التغيير',
          danger: toAdmin,
        };
      }
    }
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

  ask(kind: Kind, customer: Customer) {
    this.actionError.set(null);
    this.pending.set({ kind, customer });
  }

  cancel() {
    if (this.working()) return;
    this.pending.set(null);
  }

  confirm() {
    const action = this.pending();
    if (!action || this.working()) return;

    const c = action.customer;
    this.working.set(true);
    this.actionError.set(null);

    const request$ =
      action.kind === 'role'
        ? this.api.setRole(c.id, c.role === 'Admin' ? 'Customer' : 'Admin')
        : this.api.setBlacklisted(c.id, action.kind === 'block');

    request$.subscribe({
      next: () => {
        this.pending.set(null);
        this.working.set(false);
        this.load(); // the row may now belong to another tab
      },
      error: err => {
        this.actionError.set(
          arabicError(err, {
            400: 'تعذر تنفيذ العملية، قد لا يُسمح بتعديل هذا الحساب.',
            403: 'ليس لديك صلاحية لتنفيذ هذه العملية.',
            404: 'لم يتم العثور على العميل.',
          })
        );
        this.working.set(false);
      },
    });
  }

  initial(name: string): string {
    return name.trim().charAt(0);
  }

  // Same name always gets the same colour
  avatar(name: string) {
    const sum = [...name].reduce((n, ch) => n + ch.charCodeAt(0), 0);
    return AVATAR_COLORS[sum % AVATAR_COLORS.length];
  }

  whatsapp(phone: string): string {
    return `https://wa.me/${phone.replace(/\D/g, '')}`;
  }

  private load() {
    const id = ++this.latestRequest;
    this.loading.set(true);
    this.error.set(null);

    const f = this.filter();
    const isBlacklisted = f === 'all' ? undefined : f === 'black';

    this.api.getCustomers(this.pageNumber(), this.pageSize, isBlacklisted).subscribe({
      next: res => {
        if (id !== this.latestRequest) return; // a newer request replaced this one

        // The last row of the last page was just moved away: go back one page
        if (!res.items.length && res.pageNumber > 1) {
          this.pageNumber.set(Math.max(1, res.totalPages));
          this.load();
          return;
        }

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