import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, Observable, defaultIfEmpty, expand, filter, map, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toProxyUrl } from '../../shared/utils/url';
import { ACTION_METHOD } from '../config/action-methods';
import { AccountType, AdminRequest, ApiResponse, CategoryItem, ContactInput, PagedResult, PaymentAccount, PaymentAccountInput } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class Admin {
  private http = inject(HttpClient);
  private base = environment.mainApiUrl;

  // ---------- orders ----------

  // isSpam: true = blacklist, false = whitelist, undefined = all
  getRequests(pageNumber: number, pageSize: number, isSpam?: boolean) {
    let params = new HttpParams().set('PageNumber', pageNumber).set('PageSize', pageSize);
    if (isSpam !== undefined) params = params.set('isSpam', isSpam);

    return this.http.get<PagedResult<AdminRequest>>(`${this.base}/Request/RequestsView`, { params });
  }

  // There is no endpoint for a single request, so we walk through the pages until we find it
  findRequest(id: number): Observable<AdminRequest | null> {
    return this.getRequests(1, 50).pipe(
      expand(page =>
        page.hasNextPage && !page.items.some(r => r.id === id)
          ? this.getRequests(page.pageNumber + 1, 50)
          : EMPTY
      ),
      map(page => page.items.find(r => r.id === id) ?? null),
      filter((r): r is AdminRequest => r !== null),
      take(1),
      defaultIfEmpty(null)
    );
  }

  markRead(id: number, orderCode: string) {
    return this.http.patch<ApiResponse<unknown>>(`${this.base}/Request/Read`, { id, orderCode });
  }

  // The file is fetched through HttpClient so the login token is attached,
  // which a plain link or <img> tag could not do
  fetchFile(url: string): Observable<Blob> {
    return this.http.get(toProxyUrl(url), { responseType: 'blob' });
  }

  // ---------- settings ----------

  getPaymentAccounts() {
  return this.http
    .get<ApiResponse<PaymentAccount[]>>(`${this.base}/Payment/Payment`)
    .pipe(map(res => res.data ?? []));
}

getAccountTypes() {
  return this.http
    .get<ApiResponse<AccountType[]>>(`${this.base}/Payment/AccountTypes`)
    .pipe(map(res => res.data ?? []));
}

addPaymentAccount(body: PaymentAccountInput) {
  return this.http.post<ApiResponse<unknown>>(`${this.base}/Payment/Payment`, body);
}

deletePaymentAccount(id: number) {
  return this.http.request<ApiResponse<unknown>>(
    ACTION_METHOD.deletePayment,
    `${this.base}/Payment/Payment/${id}`
  );
}

  saveContact(body: ContactInput) {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/ContactUs/ContactUs`, body);
  }

  deleteLocation(id: number) {
    return this.http.request<ApiResponse<unknown>>(
      ACTION_METHOD.deleteLocation,
      `${this.base}/ContactUs/Location/${id}`
    );
  }

  deletePhone(id: number) {
    return this.http.request<ApiResponse<unknown>>(
      ACTION_METHOD.deletePhone,
      `${this.base}/ContactUs/Phone/${id}`
    );
  }

  // ---------- catalogue ----------

  createService(input: {
    categoryId: number;
    name: string;
    description: string;
    price: number;
    deposit: number;
    thumbnail: File | null;
  }) {
    const body = new FormData();
    body.append('CategoryId', String(input.categoryId));
    body.append('Name', input.name);
    body.append('Description', input.description);
    body.append('Price', String(input.price));
    body.append('Deposit', String(input.deposit));
    if (input.thumbnail) body.append('Thumbnail', input.thumbnail);

    return this.http.post<ApiResponse<unknown>>(`${this.base}/Service/Service`, body);
  }

  deleteService(id: number) {
    return this.http.request<ApiResponse<unknown>>(
      ACTION_METHOD.deleteService,
      `${this.base}/Service/Service/${id}`
    );
  }

  addDocument(serviceId: number, name: string, isMandatory: boolean) {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/Document/Documents`, {
      serviceId,
      name,
      isMandatory,
      isValid: true, // only valid documents are shown to customers
    });
  }

  createCategory(name: string, thumbnail: File) {
    const body = new FormData();
    body.append('Name', name);
    body.append('Thumbnail', thumbnail);

    return this.http.post<ApiResponse<unknown>>(`${this.base}/Category/Category`, body);
  }

  // A missing value means "valid"
  isCategoryActive(category: CategoryItem): boolean {
    return category.isValid ?? true;
  }

  // Switches the category between valid and not valid (the server flips the current value)
  toggleCategory(id: number) {
    return this.http.request<ApiResponse<unknown>>(
      ACTION_METHOD.categoryStatus,
      `${this.base}/Category/Status/${id}`
    );
  }
}