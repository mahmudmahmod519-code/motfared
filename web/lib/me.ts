/** The session as the API describes it (GET /api/auth/me), and what the dashboard does with it. */

export interface Entitlement {
  state: string;
  allowed: { read: boolean; write: boolean; billing: boolean; work: boolean };
  read_only: boolean;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  company_id: string | null;
  role: string | null;
  permissions: string[];
  platform_role: 'platform_admin' | null;
  team_id: number | null;
  must_change_password: boolean;
  entitlement: Entitlement | null;
}

export type MeResult =
  | { kind: 'user'; me: Me }
  | { kind: 'anonymous' }
  | { kind: 'must-change'; me?: Me }
  | { kind: 'error' };

const isObject = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function interpretMe(status: number, body: unknown): MeResult {
  if (status === 401) return { kind: 'anonymous' };
  if (status === 403 && isObject(body) && body.code === 'PASSWORD_CHANGE_REQUIRED') return { kind: 'must-change' };
  if (status !== 200 || !isObject(body) || typeof body.id !== 'string') return { kind: 'error' };
  const me: Me = {
    id: body.id,
    name: typeof body.name === 'string' ? body.name : '',
    email: typeof body.email === 'string' ? body.email : '',
    company_id: body.company_id ?? null,
    role: body.role ?? null,
    permissions: Array.isArray(body.permissions) ? body.permissions.filter((p: unknown) => typeof p === 'string') : [],
    platform_role: body.platform_role === 'platform_admin' ? 'platform_admin' : null,
    team_id: body.team_id ?? null,
    must_change_password: body.must_change_password === true,
    entitlement: isObject(body.entitlement) ? (body.entitlement as unknown as Entitlement) : null,
  };
  return me.must_change_password ? { kind: 'must-change', me } : { kind: 'user', me };
}

export type Access = 'dashboard' | 'no-dashboard' | 'platform' | 'blocked';

/** What this user is shown instead of (or as) the dashboard. Display only; the API enforces every right again. */
export function accessFor(me: Me): Access {
  if (me.platform_role === 'platform_admin') return 'platform';
  if (!me.company_id || !me.entitlement || !me.entitlement.allowed.read) return 'blocked';
  return me.permissions.includes('dashboard.view') ? 'dashboard' : 'no-dashboard';
}

/** Plain Arabic messages for the sign-in form (the original's wording where it had one). */
export function loginErrorMessage(r: { status: number; empty?: boolean }): string {
  if (r.empty) return 'من فضلك ادخل رقم التليفون وكلمة السر';
  if (r.status === 401) return 'رقم التليفون أو كلمة السر غلط';
  if (r.status === 429) return 'محاولات كتير، استنى دقيقة وجرّب تاني';
  if (r.status === 0) return 'مفيش اتصال بالسيرفر، جرّب تاني';
  return 'حصلت مشكلة، جرّب تاني';
}
