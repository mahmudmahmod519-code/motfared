/**
 * Phase 1 — the per-request tenant context: one typed principal, resolved from the database,
 * with the subscription state resolved once and nothing taken from the client.
 * Written before the consolidation.
 */
import { bootstrap } from './harness';
import { EntitlementService } from '../../src/modules/subscriptions/entitlement.service';
import { CompanyMembership, MembershipStatus } from '../../src/modules/company-memberships/entities/company-membership.entity';
import { Service } from '../../src/domain/core/service.entity';
import { Team } from '../../src/domain/core/team.entity';

describe('Tenant context', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    const A = await h.mkCompany('Ctx A');
    const B = await h.mkCompany('Ctx B');
    for (const c of [A, B]) await h.subscribe(c.id);
    Object.assign(ids, { A: A.id, B: B.id });
    for (const [co, t] of [[A.id, 'A'], [B.id, 'B']] as const) {
      ids[`owner_${t}`] = (await h.mkUser('Owner', `owner-${t}@c.test`, co, 'owner')).id;
      ids[`sales_${t}`] = (await h.mkUser('Sales', `sales-${t}@c.test`, co, 'sales')).id;
      h.tokenFor(`owner_${t}`, ids[`owner_${t}`]);
      h.tokenFor(`sales_${t}`, ids[`sales_${t}`]);
    }
    // the team on the session is the member's team in their company (a real, tenant-checked team)
    for (const [k, code] of [['teamA1', 'A'], ['teamA2', 'B']] as const) ids[k] = (await h.db.getRepository(Team).insert({ company_id: A.id, name: `T${code}`, code } as any)).identifiers[0].id;
    await h.db.getRepository(CompanyMembership).update({ user_id: ids.owner_A }, { team_id: ids.teamA1 } as any);
    ids.platform = (await h.mkUser('Plat', 'plat@c.test', null, undefined, 'platform_admin')).id;
    h.tokenFor('platform', ids.platform);
  });
  afterAll(async () => { await h.app?.close(); });

  describe('the principal', () => {
    it('has one fixed shape for a member (and never leaks credentials)', async () => {
      const me = (await h.get('owner_A', '/auth/me')).body;
      expect(Object.keys(me).sort()).toEqual(
        ['company_id', 'email', 'entitlement', 'id', 'must_change_password', 'name', 'permissions', 'platform_role', 'role', 'team_id'].sort(),
      );
      expect(me).toMatchObject({ id: ids.owner_A, name: 'Owner', company_id: ids.A, role: 'owner', team_id: ids.teamA1, must_change_password: false });
      expect(me.platform_role).toBeNull();
      expect(Array.isArray(me.permissions)).toBe(true);
      expect(JSON.stringify(me)).not.toMatch(/password_hash|token_version|phone_key/);
    });

    it('has the same shape for a platform admin: no company, no role, no permissions', async () => {
      const me = (await h.get('platform', '/auth/me')).body;
      expect(Object.keys(me).sort()).toEqual(
        ['company_id', 'email', 'entitlement', 'id', 'must_change_password', 'name', 'permissions', 'platform_role', 'role', 'team_id'].sort(),
      );
      expect(me).toMatchObject({ platform_role: 'platform_admin', company_id: null, role: null, permissions: [] });
    });

    it('a suspended membership leaves no company, role or permissions at all', async () => {
      await h.db.getRepository(CompanyMembership).update({ company_id: ids.A, user_id: ids.sales_A }, { status: MembershipStatus.SUSPENDED });
      const me = (await h.get('sales_A', '/auth/me')).body;
      expect(me).toMatchObject({ company_id: null, role: null, permissions: [], entitlement: null });
      expect((await h.get('sales_A', '/users')).status).toBe(403);
      await h.db.getRepository(CompanyMembership).update({ company_id: ids.A, user_id: ids.sales_A }, { status: MembershipStatus.ACTIVE });
    });

    it('is re-read on every request: the team changes at once', async () => {
      await h.db.getRepository(CompanyMembership).update({ user_id: ids.owner_A }, { team_id: ids.teamA2 } as any);
      expect((await h.get('owner_A', '/auth/me')).body.team_id).toBe(ids.teamA2);
    });
  });

  describe('the subscription state is resolved once per request', () => {
    let spy: jest.SpyInstance;
    beforeAll(() => { spy = jest.spyOn(h.app.get(EntitlementService), 'resolve'); });
    beforeEach(() => spy.mockClear());
    afterAll(() => spy.mockRestore());

    it.each(['/subscriptions/status', '/services', '/users'])('GET %s', async (url) => {
      const res = await h.get('owner_A', url);
      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("a platform admin has no company: /subscriptions/status reports 'none', never some company's state", async () => {
      const res = await h.get('platform', '/subscriptions/status');
      expect(res.status).toBe(200);
      expect(res.body.state).toBe('none');
      expect(res.body.subscription_id).toBeUndefined();
    });

    it('/subscriptions/status still reports the state the guard saw', async () => {
      const res = await h.get('owner_A', '/subscriptions/status');
      expect(res.body.state).toBe('active');
      expect(res.body.allowed).toMatchObject({ read: true, write: true });
    });
  });

  describe('nothing the client sends changes whose data a request touches', () => {
    it('a company_id in the query, a header or a body is ignored for members', async () => {
      await h.db.getRepository(Service).save({ company_id: ids.B, name: 'B only' } as any);
      const q = await h.http().get(`/api/services?company_id=${ids.B}`).set(h.as('owner_A')).set('X-Company-Id', ids.B).set('X-Tenant-Id', ids.B);
      expect(q.status).toBe(200);
      expect(q.body.map((s: any) => s.name)).not.toContain('B only');
      const users = await h.http().get(`/api/users?company_id=${ids.B}`).set(h.as('owner_A')).set('X-Company-Id', ids.B);
      expect(users.body.every((u: any) => u.company_id === ids.A)).toBe(true);
    });

    it("a body that names another company cannot move a write: it lands in the caller's own company", async () => {
      const res = await h.http().post('/api/services').set(h.as('owner_A')).send({ name: 'Spoof', company_id: ids.B });
      expect(res.status).toBe(201);
      expect(res.body.company_id).toBe(ids.A);
      expect(await h.db.getRepository(Service).countBy({ company_id: ids.B, name: 'Spoof' })).toBe(0);
    });

    it('a body that tries to set a platform role or permissions is rejected outright', async () => {
      for (const extra of [{ platform_role: 'platform_admin' }, { role: 'owner' }, { permissions: ['billing.manage'] }]) {
        const res = await h.http().post('/api/services').set(h.as('owner_A')).send({ name: 'Spoof2', ...extra });
        expect(res.status).toBe(400);
      }
      expect(await h.db.getRepository(Service).countBy({ name: 'Spoof2' })).toBe(0);
    });

    it('a token claiming a role or company in its payload is not believed', async () => {
      const forged = h.app.get(require('@nestjs/jwt').JwtService, { strict: false }).sign({ sub: ids.sales_A, email: 'x', role: 'owner', company_id: ids.B, platform_role: 'platform_admin', permissions: ['billing.manage'] });
      const me = (await h.http().get('/api/auth/me').set({ Authorization: `Bearer ${forged}` })).body;
      expect(me).toMatchObject({ company_id: ids.A, role: 'sales', platform_role: null });
      expect(me.permissions).not.toContain('billing.manage');
      expect((await h.http().get('/api/billing/manual-requests').set({ Authorization: `Bearer ${forged}` })).status).toBe(403);
    });
  });
});
