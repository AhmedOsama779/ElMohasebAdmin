import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, DocumentStatus, PagedResult, PaymentInfo, RequestCreated, RequestDetails, RequestOrder , ContactInfo } from '../models/api.models';@Injectable({ providedIn: 'root' })
export class Catalog {
  private http = inject(HttpClient);
  private base = environment.mainApiUrl;

  getDocumentStatus(serviceId: number) {
    return this.http
      .get<ApiResponse<DocumentStatus[]>>(`${this.base}/Document/Status/${serviceId}`)
      .pipe(map(res => res.data));
  }

  getPaymentInfo() {
    return this.http
      .get<ApiResponse<PaymentInfo>>(`${this.base}/Payment/Payment`)
      .pipe(map(res => res.data));
  }

  submitRequest(serviceId: number, receipt: File, docs: { id: number; file: File }[]) {
    // Files travel as multipart/form-data. Don't set the Content-Type header yourself:
    // the browser adds it together with the boundary that separates the parts.
    const body = new FormData();
    body.append('ServiceID', String(serviceId));
    body.append('InstaPay', receipt);
    docs.forEach(d => {
      body.append('DocumentIDs', String(d.id));
      body.append('Documents', d.file);
    });

    return this.http.post<ApiResponse<RequestCreated>>(`${this.base}/Request/RequestService`, body);
  }
  // completePaid: true = fully paid, false = awaiting payment, undefined = all
getMyOrders(pageNumber: number, pageSize: number, completePaid?: boolean) {
  let params = new HttpParams().set('PageNumber', pageNumber).set('PageSize', pageSize);
  if (completePaid !== undefined) params = params.set('completePaid', completePaid);

  // The API uses POST for this read-only query and expects no body
  return this.http.post<PagedResult<RequestOrder>>(`${this.base}/Request/RequestOrders`, null, { params });
}

getRequest(id: number) {
  return this.http
    .get<ApiResponse<RequestDetails>>(`${this.base}/Request/Request/${id}`)
    .pipe(map(res => res.data));
}

payRemaining(id: number, orderCode: string, receipt: File) {
  const body = new FormData();
  body.append('Id', String(id));
  body.append('OrderCode', orderCode);
  body.append('Recipt', receipt); // the API spells it "Recipt"

  return this.http.patch<ApiResponse<unknown>>(`${this.base}/Request/Request`, body);
}

getContact() {
  return this.http
    .get<ApiResponse<ContactInfo> | ContactInfo>(`${this.base}/ContactUs/ContactUs`)
    // Works whether or not the API wraps the data in { code, message, data }
    .pipe(map(res => ('data' in res ? res.data : res)));
}

}