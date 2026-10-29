import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin-guard';
import { AdminCategories } from './features/admin/admin-categories/admin-categories';
import { AdminCustomers } from './features/admin/admin-customers/admin-customers';
import { AdminLayout } from './features/admin/admin-layout/admin-layout';
import { AdminOffice } from './features/admin/admin-office/admin-office';
import { AdminOrderDetails } from './features/admin/admin-order-details/admin-order-details';
import { AdminOrders } from './features/admin/admin-orders/admin-orders';
import { AdminPayment } from './features/admin/admin-payment/admin-payment';
import { AdminServices } from './features/admin/admin-services/admin-services';
import { Login } from './features/login/login';

export const routes: Routes = [
  { path: '', redirectTo: 'admin/orders', pathMatch: 'full' },
  { path: 'login', component: Login },
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'orders', pathMatch: 'full' },
      { path: 'orders', component: AdminOrders },
      { path: 'orders/:id', component: AdminOrderDetails },
      { path: 'customers', component: AdminCustomers },
      { path: 'categories', component: AdminCategories },
      { path: 'services', component: AdminServices },
      { path: 'payment', component: AdminPayment },
      { path: 'office', component: AdminOffice },
    ],
  },
  { path: '**', redirectTo: 'admin/orders' },
];