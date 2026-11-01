/** Where a visitor may be sent after signing in, and which paths need a session at all. */

const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;
const SELF_PAGES = new Set(['/login', '/change-password']);

/**
 * The destination remembered across the sign-in page. Only a path on this site is accepted: anything that a
 * browser could read as another host (`//x`, `/\x`, a scheme, an encoded double slash) or that contains control
 * characters falls back to the overview, so the sign-in page cannot be used as an open redirect.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return '/';
  if (CONTROL_OR_BACKSLASH.test(raw)) return '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return '/';
  }
  if (decoded.startsWith('//') || CONTROL_OR_BACKSLASH.test(decoded)) return '/';
  if (SELF_PAGES.has(raw.split(/[?#]/)[0])) return '/';
  return raw;
}

export function loginUrl(destination: string): string {
  const next = safeNext(destination);
  return next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
}

/** Reachable without a session: the sign-in page, the public lead form and clinic page, static files, the API proxy. */
export function isPublicPath(pathname: string): boolean {
  if (pathname === '/login' || pathname === '/favicon.ico') return true;
  return ['/dr/', '/clinic/', '/_next/', '/fonts/', '/api/'].some((prefix) => pathname.startsWith(prefix) && pathname.length > prefix.length);
}

/**
 * The cheap check in front of every page: no session cookie means go and sign in. It decides nothing about
 * rights; every page validates the session against the API, and the API enforces permissions.
 */
export function gate(req: { pathname: string; search: string; hasSession: boolean }): { redirect: string } | null {
  if (isPublicPath(req.pathname) || req.hasSession) return null;
  return { redirect: loginUrl(req.pathname + req.search) };
}
