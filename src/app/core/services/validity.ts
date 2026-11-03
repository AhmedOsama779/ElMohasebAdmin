import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ApiResponse, ValidityInfo } from '../models/api.models';

const RECHECK_MS = 2 * 60 * 1000; // ask the server again every 2 minutes

// 01012345678 -> https://wa.me/201012345678. Returns null when there is no usable number.
function toWhatsapp(phone: string | null | undefined): string | null {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = '20' + digits.slice(1);
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

@Injectable({ providedIn: 'root' })
export class Validity {
  private http = inject(HttpClient);
  private info = signal<ValidityInfo | null>(null);

  // Only an explicit "false" from the server suspends the app.
  // A failed request never locks anyone out, it just keeps the last known state.
  suspended = computed(() => this.info()?.isValid === false);
  message = computed(() => this.info()?.message?.trim() || null);
  whatsappUrl = computed(() => toWhatsapp(this.info()?.phone));

  constructor() {
    this.check();
    setInterval(() => this.check(), RECHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.check();
    });
  }

  check() {
    // "t" changes every time, so the browser never serves an old cached answer
    this.http
      .get<ApiResponse<ValidityInfo>>(`${environment.mainApiUrl}/Validity/Validity`, {
        params: { t: Date.now() },
      })
      .subscribe({
        next: res => {
          if (res?.data) this.info.set(res.data);
        },
        error: () => {}, // keep the last known state
      });
  }
}