/**
 * Phase 1 — permissions enforced on real routes: a route × role matrix, company overrides taking
 * effect immediately, and the rule that nobody can grant what they do not hold.
 * Written before the conversion of the controllers from @Roles to @RequirePermission.
 */
import { bootstrap } from './harness';
import { Role } from '../../src/modules/rbac/entities/role.entity';
import { RolePermission } from '../../src/modules/rbac/entities/role-permission.entity';
import { CompanyMembership } from '../../src/modules/company-memberships/entities/company-membership.entity';

describe('Permissions on routes', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const ids: Record<string, string> = {};
  const WHO = ['owner', 'admin', 'team_lead', 'sales', 'platform'] as const;
  type Who = (typeof WHO)[number];

  const setRole = async (companyId: string, key: string, perms: string[], name = key) => {
    const roles = h.db.getRepository(Role);
    const existing = await roles.findOneBy({ company_id: companyId, key });
    if (existing) await h.db.getRepository(RolePermission).delete({ role_id: existing.id });
    const role = existing ?? (await roles.save({ company_id: companyId, key, name, is_system: ['sales', 'admin', 'team_lead'].includes(key) } as any));
    for (const permission_key of perms) await h.db.getRepository(RolePermission).save({ role_id: role.id, permission_key });
  };
  const clearOverride = async (companyId: string, key: string) => { await h.db.getRepository(Role).delete({ company_id: companyId, key }); };

  /** Who reaches the handler (anything but 403) and who is turned away with 403. */
  const expectMatrix = async (label: string, call: (who: Who) => Promise<any>, allowed: Who[]) => {
    const seen: Record<string, string> = {};
    for (const who of WHO) {
      const res = await call(who);
      seen[who] = res.status === 403 ? 'denied' : 'allowed';
    }
    const expected = Object.fromEntries(WHO.map((w) => [w, allowed.includes(w) ? 'allowed' : 'denied']));
    expect({ route: label, ...seen }).toEqual({ route: label, ...expected });
  };

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    const A = await h.mkCompany('Perm A');
    const B = await h.mkCompany('Perm B');
    const C = await h.mkCompany('Perm C');
    for (const co of [A, B, C]) await h.subscribe(co.id);
    Object.assign(ids, { A: A.id, B: B.id, C: C.id });
    const mk = async (who: Who, co: string | null, role?: string, platform?: string) => {
      ids[`${who}_${co === A.id ? 'A' : co === B.id ? 'B' : co === C.id ? 'C' : 'x'}`] = (await h.mkUser(`${who}`, `${who}-${co?.slice(0, 4)}@p.test`, co, role, platform)).id;
    };
    for (const co of [A.id, B.id, C.id]) for (const r of ['owner', 'admin', 'team_lead', 'sales']) await mk(r as Who, co, r);
    await mk('platform', null, undefined, 'platform_admin');
    for (const [k, v] of Object.entries(ids)) if (k.includes('_')) h.tokenFor(k, v);
  });
  afterAll(async () => { await h.app?.close(); });

  const tok = (who: Who, co = 'A') => (who === 'platform' ? 'platform_x' : `${who}_${co}`);
  const GET = (url: string, co = 'A') => (who: Who) => h.http().get(`/api${url}`).set(h.as(tok(who, co)));

  describe('billing side (owner only for members; platform admin where it was allowed before)', () => {
    it.each(['/billing/manual-requests', '/subscriptions', '/payments', '/billing-customers'])('GET %s', async (url) => {
      await expectMatrix(url, GET(url), ['owner', 'platform']);
    });
  });

  describe('platform admins', () => {
    it('are admitted only where a route says so: a members-only route refuses them', async () => {
      // POST /billing/manual-requests is a company action (the owner pays); the platform admin approves instead.
      const res = await h.http().post('/api/billing/manual-requests').set(h.as('platform_x')).send({});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('company data', () => {
    it('services: reading stays open to every member, writing needs services.manage', async () => {
      for (const who of ['owner', 'admin', 'team_lead', 'sales'] as Who[]) expect((await GET('/services')(who)).status).toBe(200);
      await expectMatrix(
        'POST /services',
        (who) => h.http().post('/api/services').set(h.as(tok(who))).send({ name: 'S', company_id: ids.A }),
        ['owner', 'admin', 'platform'],
      );
    });

    it('company profile: settings.manage (owner, admin)', async () => {
      await expectMatrix(
        'PATCH /companies/:id',
        (who) => h.http().patch(`/api/companies/${ids.A}`).set(h.as(tok(who))).send({ description: 'x' }),
        ['owner', 'admin', 'platform'],
      );
    });
  });

  describe('accounts', () => {
    it('listing needs accounts.view (not sales)', async () => {
      await expectMatrix('GET /users', GET('/users'), ['owner', 'admin', 'team_lead', 'platform']);
      await expectMatrix('GET /company-memberships', GET('/company-memberships'), ['owner', 'admin', 'team_lead', 'platform']);
    });

    const create = (role: string, n: string) => (who: Who) =>
      h.http().post('/api/users').set(h.as(tok(who))).send({ name: n, email: `${n}-${who}-${role}@new.test`, password: 'Sup3r#Secret', role, company_id: ids.A });

    it('creating a sales account needs accounts.manage (owner, admin)', async () => {
      await expectMatrix('create sales', create('sales', 'c1'), ['owner', 'admin', 'platform']);
    });

    it('creating an admin or a team lead needs accounts.admin (owner only)', async () => {
      await expectMatrix('create admin', create('admin', 'c2'), ['owner', 'platform']);
      await expectMatrix('create team_lead', create('team_lead', 'c3'), ['owner', 'platform']);
    });

    it('nobody inside a company can create another owner; an unknown role is a 400', async () => {
      expect((await create('owner', 'c4')('owner')).status).toBe(403);
      expect((await create('owner', 'c5')('admin')).status).toBe(403);
      expect((await create('no_such_role', 'c6')('owner')).status).toBe(400);
    });

    it('changing an account status needs accounts.admin', async () => {
      const target = ids.sales_A;
      await expectMatrix(
        'PATCH status',
        (who) => h.http().patch(`/api/users/${target}/status`).set(h.as(tok(who))).send({ status: 'active' }),
        ['owner', 'platform'],
      );
    });

    it("editing someone else's profile needs accounts.manage, and only for roles the actor may manage", async () => {
      const edit = (target: string) => (who: Who) => h.http().patch(`/api/users/${target}`).set(h.as(tok(who))).send({ address: 'Cairo' });
      expect((await edit(ids.sales_A)('admin')).status).toBe(200);
      expect((await edit(ids.sales_A)('team_lead')).status).toBe(404); // cannot even see it: no accounts.manage
      expect((await edit(ids.team_lead_A)('admin')).status).toBe(403); // a team lead is above what an admin may manage
      expect((await edit(ids.owner_A)('admin')).status).toBe(403);
      expect((await edit(ids.team_lead_A)('owner')).status).toBe(200);
    });

    it('memberships: an admin may not promote, demote or remove anyone above a sales account; the owner may', async () => {
      const mem = (u: string) => h.db.getRepository(CompanyMembership).findOneByOrFail({ company_id: ids.A, user_id: u });
      const salesM = await mem(ids.sales_A);
      const leadM = await mem(ids.team_lead_A);
      const patch = (id: string, role: string) => (who: Who) => h.http().patch(`/api/company-memberships/${id}`).set(h.as(tok(who))).send({ role });
      expect((await patch(salesM.id, 'admin')('admin')).status).toBe(403); // promoting
      expect((await patch(leadM.id, 'sales')('admin')).status).toBe(403); // touching a team lead
      expect((await patch(salesM.id, 'team_lead')('owner')).status).toBe(200);
      expect((await patch(salesM.id, 'sales')('owner')).status).toBe(200);
      const ownerM = await mem(ids.owner_A);
      expect((await patch(ownerM.id, 'sales')('owner')).status).toBe(403); // no tenant actor can demote an owner
    });
  });

  describe('the mobile facade needs leads.work', () => {
    it('a role without it is refused on /api/mobile, one with it is not', async () => {
      await setRole(ids.C, 'sales', ['dashboard.view']); // no leads.work
      expect((await GET('/mobile/leads', 'C')('sales')).status).toBe(403);
      await setRole(ids.C, 'sales', ['leads.work']);
      expect((await GET('/mobile/leads', 'C')('sales')).status).toBe(200);
      expect((await GET('/mobile/leads', 'A')('sales')).status).toBe(200);
    });
  });

  describe('company overrides take effect on the next request, and only in their company', () => {
    it('granting accounts.view to sales opens /users for sales of that company only', async () => {
      expect((await GET('/users', 'C')('sales')).status).toBe(403);
      await setRole(ids.C, 'sales', ['leads.work', 'accounts.view']);
      expect((await GET('/users', 'C')('sales')).status).toBe(200);
      expect((await GET('/users', 'A')('sales')).status).toBe(403);
      expect((await GET('/users', 'B')('sales')).status).toBe(403);
    });

    it('removing a permission from admin closes the route at once', async () => {
      expect((await GET('/users', 'B')('admin')).status).toBe(200);
      await setRole(ids.B, 'admin', ['leads.work']); // admin of company B loses almost everything
      expect((await GET('/users', 'B')('admin')).status).toBe(403);
      expect((await GET('/users', 'A')('admin')).status).toBe(200);
    });

    it('a custom role works through the same gates', async () => {
      await setRole(ids.A, 'auditor', ['accounts.view', 'leads.work'], 'Auditor');
      await h.db.getRepository(CompanyMembership).update({ company_id: ids.A, user_id: ids.sales_A }, { role: 'auditor' });
      expect((await GET('/users')('sales')).status).toBe(200);
      expect((await h.http().post('/api/services').set(h.as(tok('sales'))).send({ name: 'S' })).status).toBe(403);
      await h.db.getRepository(CompanyMembership).update({ company_id: ids.A, user_id: ids.sales_A }, { role: 'sales' });
    });
  });

  describe('nobody can grant what they do not hold', () => {
    it('an account manager with accounts.admin still cannot hand out a role that carries permissions they lack', async () => {
      // company C: admin may create privileged accounts but does not hold billing.manage
      await setRole(ids.C, 'admin', ['leads.work', 'accounts.manage', 'accounts.admin', 'accounts.view']);
      await setRole(ids.C, 'cashier', ['leads.work', 'billing.manage'], 'Cashier');
      const post = (role: string) =>
        h.http().post('/api/users').set(h.as('admin_C')).send({ name: 'x', email: `esc-${role}@new.test`, password: 'Sup3r#Secret', role });
      expect((await post('cashier')).status).toBe(403);
      expect((await post('team_lead')).status).toBe(403); // team_lead holds leads.manage/dashboard.view which this admin no longer has
      expect((await post('sales')).status).toBe(201);
    });
  });

  describe('the dashboard follows dashboard.view, not a role name', () => {
    it('without it a member gets their own figures; with it, the company figures', async () => {
      const own = await GET('/dashboard/stats', 'A')('sales');
      const company = await GET('/dashboard/stats', 'A')('owner');
      expect(own.status).toBe(200);
      expect(Object.keys(own.body).sort()).not.toEqual(Object.keys(company.body).sort());
      await setRole(ids.C, 'sales', ['leads.work', 'dashboard.view']);
      const promoted = await GET('/dashboard/stats', 'C')('sales');
      expect(Object.keys(promoted.body).sort()).toEqual(Object.keys((await GET('/dashboard/stats', 'C')('owner')).body).sort());
    });
  });
});
