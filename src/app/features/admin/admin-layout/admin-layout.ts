import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
})
export class AdminLayout {
  private auth = inject(Auth);
  private router = inject(Router);

  // Only "الطلبات" has a page for now, the others are shown but disabled
  items = [
    { label: 'الطلبات', link: '/admin/orders', icon: 'orders' },
    { label: 'العملاء', link: '/admin/customers', icon: 'customers' },
    { label: 'التصنيفات', link: '/admin/categories', icon: 'categories' },
    { label: 'الخدمات', link: '/admin/services', icon: 'services' },
    { label: 'إعدادات الدفع', link: '/admin/payment', icon: 'payment' },
    { label: 'معلومات المكتب', link: '/admin/office', icon: 'office' },
  ];

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}