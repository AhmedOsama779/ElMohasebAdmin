// The "IPAN" from the API is the Egyptian phone number linked to InstaPay.
// Show it as +2 followed by the local number (01xxxxxxxxx)
export function formatEgyptPhone(raw: string | undefined | null): string {
  if (!raw) return '';
  const value = raw.replace(/[\s-]/g, '');
  if (/^01\d{9}$/.test(value)) return `+2${value}`;   // 01023456789  -> +201023456789
  if (/^201\d{9}$/.test(value)) return `+${value}`;   // 201023456789 -> +201023456789
  if (/^\+201\d{9}$/.test(value)) return value;       // already complete
  return raw;                                         // anything else is shown as it came
}

// Arabic month names but Latin digits, like "14 أكتوبر 2024"
const dateFormat = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

const dateTimeFormat = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}