import { describe, expect, it } from 'vitest';
import { accessFor, interpretMe, loginErrorMessage } from '../lib/me';

const member = (over: Record<string, any> = {}) => ({
  id: 'u1', name: 'Owner', email: 'o@x.t', company_id: 'c1', role: 'owner', permissions: ['dashboard.view', 'leads.work'],
  platform_role: null, team_id: null, must_change_password: false,
  entitlement: { state: 'active', allowed: { read: true, write: true, billing: true, work: true }, read_only: false },
  ...over,
});

describe('interpretMe: what /api/auth/me said', () => {
  it('a 200 with a body is a signed-in user', () => {
    expect(interpretMe(200, member())).toMatchObject({ kind: 'user', me: { name: 'Owner' } });
  });
  it('401 means not signed in', () => {
    expect(interpretMe(401, { message: 'x' })).toEqual({ kind: 'anonymous' });
  });
  it('a forced password change is its own state (the API answers 403 PASSWORD_CHANGE_REQUIRED elsewhere, but /me answers 200 with the flag)', () => {
    expect(interpretMe(200, member({ must_change_password: true }))).toMatchObject({ kind: 'must-change' });
    expect(interpretMe(403, { code: 'PASSWORD_CHANGE_REQUIRED' })).toEqual({ kind: 'must-change' });
  });
  it('server trouble, a missing body or garbage is an error, never a signed-in user', () => {
    for (const [s, b] of [[500, {}], [502, null], [200, null], [200, 'html'], [200, {}], [200, { id: 5 }]] as const) {
      expect([s, interpretMe(s, b as any).kind]).toEqual([s, 'error']);
    }
  });
  it('a user missing the permission list is treated as having none', () => {
    const r = interpretMe(200, member({ permissions: undefined }));
    expect(r.kind === 'user' && r.me.permissions).toEqual([]);
  });
});

describe('accessFor: what the dashboard shows this user', () => {
  it('a member who may open the dashboard gets it', () => {
    expect(accessFor(member() as any)).toBe('dashboard');
  });
  it('a rep (no dashboard.view) is told the dashboard is for managers, as the original does at login', () => {
    expect(accessFor(member({ role: 'sales', permissions: ['leads.work'] }) as any)).toBe('no-dashboard');
  });
  it('a platform admin has no company: the company dashboard is not theirs', () => {
    expect(accessFor(member({ platform_role: 'platform_admin', company_id: null, role: null, permissions: [], entitlement: null }) as any)).toBe('platform');
  });
  it('a lapsed company blocks everyone who may not even read', () => {
    const blocked = { state: 'expired', allowed: { read: false, write: false, billing: true, work: false }, read_only: false };
    expect(accessFor(member({ role: 'admin', entitlement: blocked }) as any)).toBe('blocked');
  });
  it('the owner of a lapsed company still gets the dashboard, read-only', () => {
    const ro = { state: 'expired', allowed: { read: true, write: false, billing: true, work: false }, read_only: true };
    expect(accessFor(member({ entitlement: ro }) as any)).toBe('dashboard');
  });
  it('a member with no entitlement information is not shown company data', () => {
    expect(accessFor(member({ entitlement: null }) as any)).toBe('blocked');
  });
});

describe('loginErrorMessage', () => {
  it('asks for both fields (the original\'s wording)', () => {
    expect(loginErrorMessage({ status: 0, empty: true })).toBe('من فضلك ادخل رقم التليفون وكلمة السر');
  });
  it('wrong credentials, too many tries and everything else each have their own plain message', () => {
    const m = [401, 429, 500, 0].map((status) => loginErrorMessage({ status }));
    expect(new Set(m).size).toBe(4);
    for (const x of m) expect(x).toMatch(/[؀-ۿ]/);
  });
  it('a wrong phone and a wrong password read the same (the API does not reveal which)', () => {
    expect(loginErrorMessage({ status: 401 })).toBe(loginErrorMessage({ status: 401 }));
  });
});
