// PRODUCTION (used by `ng build` / Vercel).
// All requests go through the Vercel proxy (see vercel.json), so the browser
// only ever talks to the HTTPS Vercel domain: no mixed-content errors.
export const environment = {
  production: true,
  host: '/backend',
  apiUrl: '/backend/Auth/api',   // auth endpoints
  mainApiUrl: '/backend/api',    // the rest of the API
};
