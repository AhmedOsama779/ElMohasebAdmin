import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { delay, map, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCustomer, ApiResponse, Customer, CustomerRole, PagedResult } from '../models/api.models';

// The customers LIST is real. Blocking and changing roles are not confirmed on the server yet,
// so in development builds they only change what you see (in memory, lost on refresh).
// Production builds always call the server.
const MOCK_ENABLED = true; // TODO: set to false once the real endpoints are confirmed
const USE_MOCK = MOCK_ENABLED && !environment.production;

const mockBlacklist = new Map<string, boolean>();
const mockRole = new Map<string, CustomerRole>();

// The list may arrive as a paged object, a wrapped paged object, or a plain array
type RawList = PagedResult<ApiCustomer> | ApiResponse<PagedResult<ApiCustomer>> | ApiCustomer[];

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private http = inject(HttpClient);
  private base = environment.mainApiUrl;

  // isBlacklisted: true = blacklist, false = whitelist, undefined = all
  getCustomers(pageNumber: number, pageSize: number, isBlacklisted?: boolean): Observable<PagedResult<Customer>> {
    let params = new HttpParams().set('PageNumber', pageNumber).set('PageSize', pageSize);

    // The filter name is a guess (same as the orders list). In development the blacklist is
    // partly local, so the filter is applied below instead of on the server.
    if (isBlacklisted !== undefined && !USE_MOCK) params = params.set('isSpam', isBlacklisted);

    return this.http.get<RawList>(`${this.base}/Customers/Customers`, { params }).pipe(
      map(raw => this.toPage(raw, pageNumber, pageSize)),
      map(page => ({
        ...page,
        // Also filtering here keeps the tabs correct if the server ignores the filter
        items: page.items
          .map(c => this.toCustomer(c))
          .filter(c => isBlacklisted === undefined || c.isBlacklisted === isBlacklisted),
      }))
    );
  }

  // TODO: confirm the real endpoint and body in Swagger
  setBlacklisted(id: string, isBlacklisted: boolean): Observable<unknown> {
    if (USE_MOCK) {
      mockBlacklist.set(id, isBlacklisted);
      return of(null).pipe(delay(300));
    }
    return this.http.patch<ApiResponse<unknown>>(`${this.base}/Customers/Blacklist`, { id, isBlacklisted });
  }

  // TODO: confirm the real endpoint and body in Swagger
  setRole(id: string, role: CustomerRole): Observable<unknown> {
    if (USE_MOCK) {
      mockRole.set(id, role);
      return of(null).pipe(delay(300));
    }
    return this.http.patch<ApiResponse<unknown>>(`${this.base}/Customers/Role`, { id, role });
  }

  private toPage(raw: RawList, pageNumber: number, pageSize: number): PagedResult<ApiCustomer> {
    if (Array.isArray(raw)) {
      return {
        items: raw,
        pageNumber,
        pageSize,
        totalCount: raw.length,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      };
    }
    return 'data' in raw ? raw.data : raw;
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
      // The server sends an Arabic label, so we look for the word "مدير" (admin)
      role: mockRole.get(c.id) ?? (/مدير|admin/i.test(c.role ?? '') ? 'Admin' : 'Customer'),
      isBlacklisted: mockBlacklist.get(c.id) ?? c.isSpam,
    };
  }
}