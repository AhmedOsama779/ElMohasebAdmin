import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, Observable, defaultIfEmpty, delay, expand, filter, map, of, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminRequest,
  ApiResponse,
  CategoryItem,
  ContactInput,
  PagedResult,
  PaymentInfo,
  RequestExtras,
} from '../models/api.models';
import { toProxyUrl } from '../../shared/utils/url';

// Parts the server can't do yet run on sample data in development builds only.
// Production builds always call the real API.
const MOCK_ENABLED = true; // TODO: set to false once the server supports them
const USE_MOCK = MOCK_ENABLED && !environment.production;

// In memory only, lost on refresh
const mockActive = new Map<number, boolean>();

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

  // Sample data in development, nothing in production
  getRequestExtras(id: number): Observable<RequestExtras | null> {
    if (!USE_MOCK) return of(null);

    return of<RequestExtras>({
      isPaidComplete: id % 2 === 0,
      depositReference: 'REF-77281920',
      remainingReference: id % 2 === 0 ? 'REF-99482103' : null,
      remainingReceiptUrl: null,
      documents: [
  { id: 1, name: 'السجل التجاري المعتمد.pdf', url: null, kind: 'pdf', sizeBytes: Math.round(2.4 * 1024 * 1024), uploadedAt: '2024-10-24T09:30:00Z' },
  { id: 2, name: 'ميزان المراجعة والقوائم المالية غير المدققة 2023.pdf', url: null, kind: 'pdf', sizeBytes: Math.round(5.8 * 1024 * 1024), uploadedAt: '2024-10-24T09:42:00Z' },
  { id: 3, name: 'شهادة الزكاة وضريبة الدخل للعام السابق.png', url: null, kind: 'image', sizeBytes: Math.round(1.1 * 1024 * 1024), uploadedAt: '2024-10-25T11:05:00Z' },
  { id: 4, name: 'عقد التأسيس وملاحق التعديل.pdf', url: null, kind: 'pdf', sizeBytes: Math.round(4.2 * 1024 * 1024), uploadedAt: '2024-10-25T11:20:00Z' },
      ],
    }).pipe(delay(300));
  }

  // ---------- settings ----------

  savePayment(body: PaymentInfo) {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/Payment/Payment`, body);
  }

  saveContact(body: ContactInput) {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/ContactUs/ContactUs`, body);
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

  // A missing status means "active"
  isCategoryActive(category: CategoryItem): boolean {
    return category.isActive ?? mockActive.get(category.id) ?? true;
  }

  setCategoryActive(id: number, isActive: boolean): Observable<unknown> {
    if (USE_MOCK) {
      mockActive.set(id, isActive);
      return of(null).pipe(delay(250));
    }
    return this.http.patch<ApiResponse<unknown>>(`${this.base}/Category/Status`, { id, isActive });
  }
}