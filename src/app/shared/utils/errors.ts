// Turns a failed HTTP call into an Arabic message we control,
// instead of showing the backend's (English) text to the user
export function arabicError(err: { status?: number }, byStatus: Record<number, string> = {}): string {
  if (err.status === 0) return 'تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت';
  if (err.status && byStatus[err.status]) return byStatus[err.status];
  if (err.status === 401) return 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى';
  if (err.status && err.status >= 500) return 'حدث خطأ في الخادم، حاول مرة أخرى لاحقًا';
  return 'حدث خطأ غير متوقع، حاول مرة أخرى';
}