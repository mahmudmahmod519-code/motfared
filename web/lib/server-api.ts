import { cookies } from 'next/headers';
import { cache } from 'react';
import { API_URL, getMe } from './api';
import { errorMessage } from './http';
import type { Me } from './me';

/** The session for this render: everything a page asks shares one request to the API. */
export const getSession = cache(getMe);

export type Loaded<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

/** A read on the server with the visitor's own cookie, never cached. A failure is returned, not thrown, so a page can say what went wrong. */
export async function serverGet<T>(path: string): Promise<Loaded<T>> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, { headers: { cookie: cookies().toString() }, cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, message: errorMessage(res.status, body) };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, status: 0, message: errorMessage(0, null) };
  }
}

/** What the signed-in user may do on a page. Display only: the API checks every request again. */
export interface Abilities {
  me: Me;
  has: (permission: string) => boolean;
  /** False while the subscription is lapsed (read-only) - every write control is hidden then. */
  canWrite: boolean;
}

export async function abilities(): Promise<Abilities | null> {
  const session = await getSession();
  if (session.kind !== 'user') return null; // the layout has already redirected or shown its screen
  const held = new Set(session.me.permissions);
  return {
    me: session.me,
    has: (p) => held.has(p),
    canWrite: session.me.entitlement?.allowed.write !== false,
  };
}
