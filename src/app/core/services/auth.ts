import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, LoginRequest } from '../models/api.models';

const CLAIM_NAME = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';
const CLAIM_EMAIL = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';
const CLAIM_ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

// Reads the middle part of a JWT. This is only for showing info,
// the real security check always happens on the server.
function decodeJwt(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  token = signal<string | null>(localStorage.getItem('token'));
  private payload = computed(() => {
    const token = this.token();
    return token ? decodeJwt(token) : null;
  });

  user = computed(() => {
    const p = this.payload();
    return p ? { name: (p[CLAIM_NAME] ?? '') as string, email: (p[CLAIM_EMAIL] ?? '') as string } : null;
  });
  role = computed(() => (this.payload()?.[CLAIM_ROLE] ?? null) as string | null);

  constructor() {
    // A token left over from an old session may have expired
    if (this.token() && !this.isLoggedIn()) this.logout();
  }

  // A method, so the expiry time is checked again on every call
  isLoggedIn(): boolean {
    const p = this.payload();
    if (!p) return false;
    return !p['exp'] || p['exp'] * 1000 > Date.now();
  }

  isAdmin(): boolean {
    return this.isLoggedIn() && this.role() === 'Admin';
  }

  logout() {
    localStorage.removeItem('token');
    this.token.set(null);
  }

  login(body: LoginRequest) {
    return this.http.post<ApiResponse<string>>(`${this.base}/Login`, body).pipe(
      tap(res => {
        if (res.code !== 200 || !res.data) throw { status: res.code, error: res };
        localStorage.setItem('token', res.data);
        this.token.set(res.data);
      })
    );
  }
}