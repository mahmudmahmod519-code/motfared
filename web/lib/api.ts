import { cookies } from 'next/headers';
import { interpretMe, type MeResult } from './me';

/** Where the API lives, from the web server's point of view (the browser only ever talks to this web app). */
export const API_URL = process.env.API_URL || 'http://127.0.0.1:3000';

/** The signed-in user, read on the server with the visitor's own cookie. Never cached. */
export async function getMe(): Promise<MeResult> {
  const cookieHeader = cookies().toString();
  if (!cookieHeader.includes('access_token=')) return { kind: 'anonymous' };
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    const body = await res.json().catch(() => null);
    return interpretMe(res.status, body);
  } catch {
    return { kind: 'error' };
  }
}
