/**
 * Talking to the API from the browser. Every request goes to this web app's own `/api/*`, which forwards it to
 * the backend (next.config.js), so the session cookie travels on its own and the browser never sees port 3000.
 * Failures become an ApiError carrying a sentence a person can act on, in the dashboard's Arabic.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const isObject = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ARABIC = /[؀-ۿ]/;

/** Stable codes the API sends whose meaning the page should state in its own words. */
const CODE_MESSAGES: Record<string, string> = {
  SUBSCRIPTION_EXPIRED: 'الاشتراك منتهي: التعديل مقفول لحد ما الاشتراك يتجدّد',
  COMPANY_SUSPENDED: 'حساب الشركة موقوف، كلّم الدعم',
  LIMIT_EXCEEDED: 'وصلت للحد المسموح في باقتك',
  PASSWORD_CHANGE_REQUIRED: 'لازم تغيّر كلمة السر الأول',
};

/** The few English messages the API still sends for things a dashboard user can cause. */
const ENGLISH_MESSAGES: [RegExp, string][] = [
  [/email already exists/i, 'الإيميل ده متسجّل لحساب تاني'],
  [/phone number is already used/i, 'رقم التليفون ده مستخدم لحساب تاني'],
  [/not allowed|forbidden|cannot/i, 'مش مسموح لك تعمل ده'],
  [/password must be longer|password.*(short|least)/i, 'كلمة السر لازم تكون 8 حروف أو أكتر'],
  [/email must be an email/i, 'الإيميل مش مكتوب صح'],
  [/not found/i, 'العنصر ده مش موجود، يمكن اتمسح'],
];

/** The sentence shown for a failed request. Arabic text from the API is the original's wording and is kept. */
export function errorMessage(status: number, body: unknown): string {
  if (status === 0) return 'مفيش اتصال بالسيرفر، جرّب تاني';
  const b = isObject(body) ? body : {};
  if (typeof b.code === 'string' && CODE_MESSAGES[b.code]) return CODE_MESSAGES[b.code];
  const raw: unknown = Array.isArray(b.message) ? b.message.join('، ') : b.message;
  if (typeof raw === 'string' && ARABIC.test(raw)) return raw;
  if (status === 401) return 'الجلسة انتهت، سجّل دخول تاني';
  if (status === 429) return 'محاولات كتير، استنى دقيقة وجرّب تاني';
  if (typeof raw === 'string') for (const [re, msg] of ENGLISH_MESSAGES) if (re.test(raw)) return msg;
  if (status === 403) return 'مش مسموح لك تعمل ده';
  if (status === 404) return 'العنصر ده مش موجود، يمكن اتمسح';
  if (status === 400) return 'البيانات دي مش مظبوطة، راجعها وجرّب تاني';
  return 'حصلت مشكلة، جرّب تاني';
}

/** One request to the API. Resolves to the parsed body; rejects with ApiError. */
export async function apiRequest<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, errorMessage(0, null));
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, body), isObject(body) && typeof body.code === 'string' ? body.code : undefined);
  return body as T;
}
