import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CategoryItem, PagedResult } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class Category {
  private http = inject(HttpClient);

  getAll(pageNumber = 1, pageSize = 20) {
    const params = new HttpParams().set('PageNumber', pageNumber).set('PageSize', pageSize);
    return this.http.get<PagedResult<CategoryItem>>(`${environment.mainApiUrl}/Category/Category`, { params });
  }
}