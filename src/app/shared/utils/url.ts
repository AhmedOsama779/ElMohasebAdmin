import { environment } from '../../../environments/environment';

const BACKEND_HTTP_ORIGIN = 'http://mohaseb-api.runasp.net';

/**
 * If the API returns absolute URLs (images, documents, receipts...) such as
 * "http://mohaseb-api.runasp.net/uploads/a.pdf", the browser blocks them on an
 * HTTPS page (mixed content). This rewrites them to go through the proxy:
 *   production  -> "/backend/uploads/a.pdf"
 *   development -> unchanged (host is the same HTTP origin)
 *
 * Relative paths ("/uploads/a.pdf" or "uploads/a.pdf") are prefixed with host.
 */
export function toProxyUrl(url: string | null | undefined): string {
  if (!url) {
    return '';
  }

  if (url.startsWith(BACKEND_HTTP_ORIGIN)) {
    return url.replace(BACKEND_HTTP_ORIGIN, environment.host);
  }

  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  const path = url.startsWith('/') ? url : `/${url}`;
  return `${environment.host}${path}`;
}