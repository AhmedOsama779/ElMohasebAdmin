import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ACTION_METHOD } from '../config/action-methods';
import { ApiCustomer, ApiResponse, Customer, PagedResult } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private http = inject(HttpClient);
  private base = environment.mainApiUrl;

  // isBlacklisted: true = blacklist, false = whitelist, undefined = all
  getCustomers(pageNumber: number, pageSize: number, isBlacklisted?: boolean): Observable<PagedResult<Customer>> {
    let params = new HttpParams().set('PageNumber', pageNumber).set('PageSize', pageSize);
    if (isBlacklisted !== undefined) params = params.set('isSpam', isBlacklisted);

    return this.http.get<PagedResult<ApiCustomer>>(`${this.base}/Customers/Customers`, { params }).pipe(
      map(page => ({
        ...page,
        // Filtering here too keeps the tabs correct even if the server ignores the filter
        items: page.items
          .map(c => this.toCustomer(c))
          .filter(c => isBlacklisted === undefined || c.isBlacklisted === isBlacklisted),
      }))
    );
  }

  // Both calls switch the current state, the server decides the new one
  toggleRole(accountId: string) {
    return this.http.request<ApiResponse<unknown>>(ACTION_METHOD.role, `${this.base}/Customers/Roles`, {
      body: { accountID: accountId },
    });
  }

  toggleBlock(accountId: string) {
    return this.http.request<ApiResponse<unknown>>(ACTION_METHOD.block, `${this.base}/Customers/Block`, {
      body: { accountID: accountId },
    });
  }

  private toCustomer(c: ApiCustomer): Customer {
    const phone = c.phone ?? '';

    return {
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: phone && !phone.startsWith('+') ? `+${phone}` : phone,
      country: c.country,
      city: c.city,
      // The server sends an Arabic label, so we look for the usual words for "admin" (and roleID 1)
      role: c.roleID === 1 || /مدير|مشرف|أدمن|ادمن|مسؤول|admin/i.test(c.role ?? '') ? 'Admin' : 'Customer',
      isBlacklisted: c.isSpam,
    };
  }
}