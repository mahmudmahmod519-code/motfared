/**
 * Phase 1 — role and permission management (/api/permissions, /api/roles).
 * Written before the implementation.
 */
import { bootstrap } from './harness';
import { Role } from '../../src/modules/rbac/entities/role.entity';
import { RolePermission } from '../../src/modules/rbac/entities/role-permission.entity';
import { CompanyMembership } from '../../src/modules/company-memberships/entities/company-membership.entity';
import { Subscription, SubscriptionStatus } from '../../src/modules/subscriptions/entities/subscription.entity';
import { PERMISSIONS, PERMISSION_KEYS, SYSTEM_ROLES, systemRole } from '../../src/modules/rbac/permissions.catalogue';

describe('Role management (/api/roles, /api/permissions)', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const ids: Record<string, string> = {};
  const sorted = (a: string[]) => [...a].sort();
  const roleRows = (co: string) => h.db.getRepository(Role).find({ where: { company_id: co } });

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    const A = await h.mkCompany('Roles A');
    const B = await h.mkCompany('Roles B');
    const X = await h.mkCompany('Roles Expired');
    for (const c of [A, B]) await h.subscribe(c.id);
    await h.db.getRepository(Subscription).save({ company_id: X.id, plan_price_id: (await h.subscribe(A.id)).plan_price_id, status: SubscriptionStatus.EXPIRED, starts_at: new Date(Date.now() - 60 * 864e5), current_period_end: new Date(Date.now() - 30 * 864e5) } as any);
    Object.assign(ids, { A: A.id, B: B.id, X: X.id });
    for (const [co, tag] of [[A.id, 'A'], [B.id, 'B']] as const) {
      for (const r of ['owner', 'admin', 'team_lead', 'sales']) {
        ids[`${r}_${tag}`] = (await h.mkUser(r, `${r}-${tag}@ro.test`, co, r)).id;
        h.tokenFor(`${r}_${tag}`, ids[`${r}_${tag}`]);
      }
    }
    ids.owner_X = (await h.mkUser('owner', 'owner-x@ro.test', X.id, 'owner')).id;
    h.tokenFor('owner_X', ids.owner_X);
    ids.platform = (await h.mkUser('platform', 'platform@ro.test', null, undefined, 'platform_admin')).id;
    h.tokenFor('platform', ids.platform);
  });
  afterAll(async () => { await h.app?.close(); });

  describe('GET /permissions', () => {
    it('lists the catalogue for anyone allowed to see roles (owner), not for others', async () => {
      const ok = await h.get('owner_A', '/permissions');
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual(expect.arrayContaining(PERMISSIONS.map((p) => expect.objectContaining({ key: p.key, group: p.group, description: p.description }))));
      expect(ok.body).toHaveLength(PERMISSIONS.length);
      for (const w of ['admin_A', 'team_lead_A', 'sales_A', 'platform']) expect((await h.get(w, '/permissions')).status).toBe(403);
    });
  });

  describe('GET /roles', () => {
    it('lists the four system roles with their defaults and member counts', async () => {
      const res = await h.get('owner_A', '/roles');
      expect(res.status).toBe(200);
      expect(res.body.map((r: any) => r.key)).toEqual(['owner', 'admin', 'team_lead', 'sales']);
      for (const r of res.body) {
        expect(r).toMatchObject({ is_system: true, customized: false, member_count: 1 });
        expect(sorted(r.permissions)).toEqual(sorted(systemRole(r.key)!.permissions));
      }
    });

    it('only roles.view holders may list; admin, team lead and sales may not', async () => {
      for (const w of ['admin_A', 'team_lead_A', 'sales_A']) expect((await h.get(w, '/roles')).status).toBe(403);
    });

    it('GET /roles/:key returns one role, 404 for an unknown one', async () => {
      expect((await h.get('owner_A', '/roles/sales')).body.key).toBe('sales');
      expect((await h.get('owner_A', '/roles/nope')).status).toBe(404);
    });
  });

  describe('POST /roles (custom roles)', () => {
    it('creates a custom role', async () => {
      const res = await h.post('owner_A', '/roles', { key: 'night_shift', name: 'Night shift', permissions: ['leads.work', 'reports.view'] });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ key: 'night_shift', name: 'Night shift', is_system: false, member_count: 0 });
      expect(sorted(res.body.permissions)).toEqual(['leads.work', 'reports.view']);
      const rows = await roleRows(ids.A);
      expect(rows.map((r) => r.key)).toContain('night_shift');
    });

    it('is visible in the list after the system roles, and only in its own company', async () => {
      expect((await h.get('owner_A', '/roles')).body.map((r: any) => r.key)).toEqual(['owner', 'admin', 'team_lead', 'sales', 'night_shift']);
      expect((await h.get('owner_B', '/roles')).body.map((r: any) => r.key)).toEqual(['owner', 'admin', 'team_lead', 'sales']);
      expect((await h.get('owner_B', '/roles/night_shift')).status).toBe(404);
    });

    it('can be assigned to a member through the memberships API, and then governs their access', async () => {
      const m = await h.db.getRepository(CompanyMembership).findOneByOrFail({ company_id: ids.A, user_id: ids.sales_A });
      expect((await h.patch('owner_A', `/company-memberships/${m.id}`, { role: 'night_shift' })).status).toBe(200);
      const me = await h.get('sales_A', '/auth/me');
      expect(sorted(me.body.permissions)).toEqual(['leads.work', 'reports.view']);
      expect((await h.get('owner_A', '/roles/night_shift')).body.member_count).toBe(1);
      expect((await h.patch('owner_A', `/company-memberships/${m.id}`, { role: 'sales' })).status).toBe(200);
    });

    it.each([
      ['a system key', { key: 'sales', name: 'X', permissions: [] }, [400, 409]],
      ['the owner key', { key: 'owner', name: 'X', permissions: [] }, [400, 409]],
      ['a bad key', { key: 'Has Space', name: 'X', permissions: [] }, [400]],
      ['a too-short key', { key: 'a', name: 'X', permissions: [] }, [400]],
      ['no name', { key: 'valid_key', permissions: [] }, [400]],
      ['an unknown permission', { key: 'valid_key', name: 'X', permissions: ['no.such'] }, [400]],
      ['permissions that are not strings', { key: 'valid_key', name: 'X', permissions: [1] }, [400]],
      ['permissions that are not an array', { key: 'valid_key', name: 'X', permissions: 'leads.work' }, [400]],
    ])('rejects %s', async (_l, body, statuses) => {
      expect(statuses).toContain((await h.post('owner_A', '/roles', body)).status);
    });

    it('a duplicate key in the same company is a 409; the same key in another company is fine', async () => {
      expect((await h.post('owner_A', '/roles', { key: 'night_shift', name: 'Again', permissions: [] })).status).toBe(409);
      expect((await h.post('owner_B', '/roles', { key: 'night_shift', name: 'B night', permissions: ['leads.work'] })).status).toBe(201);
    });

    it('de-duplicates the permission list', async () => {
      const res = await h.post('owner_A', '/roles', { key: 'dupes', name: 'Dupes', permissions: ['leads.work', 'leads.work'] });
      expect(res.status).toBe(201);
      expect(res.body.permissions).toEqual(['leads.work']);
    });

    it('is refused to members without roles.manage', async () => {
      for (const w of ['admin_A', 'team_lead_A', 'sales_A', 'platform']) {
        expect((await h.post(w, '/roles', { key: 'x_role', name: 'X', permissions: [] })).status).toBe(403);
      }
    });
  });

  describe('PUT /roles/:key', () => {
    it("changing a system role copies it for this company only, and takes effect on the next request", async () => {
      const res = await h.http().put('/api/roles/sales').set(h.as('owner_A')).send({ permissions: ['leads.work', 'dashboard.view'] });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ key: 'sales', is_system: true, customized: true });
      expect(sorted(res.body.permissions)).toEqual(['dashboard.view', 'leads.work']);
      expect(sorted((await h.get('sales_A', '/auth/me')).body.permissions)).toEqual(['dashboard.view', 'leads.work']);
      expect((await h.get('sales_B', '/auth/me')).body.permissions).toEqual(['leads.work']); // company B untouched
      expect((await roleRows(ids.B)).map((r) => r.key)).not.toContain('sales');
    });

    it('a second change replaces the first, it does not accumulate', async () => {
      await h.http().put('/api/roles/sales').set(h.as('owner_A')).send({ permissions: ['leads.work'] });
      expect((await h.get('sales_A', '/auth/me')).body.permissions).toEqual(['leads.work']);
      const rows = (await roleRows(ids.A)).filter((r) => r.key === 'sales');
      expect(rows).toHaveLength(1);
      expect(await h.db.getRepository(RolePermission).countBy({ role_id: rows[0].id })).toBe(1);
    });

    it('renames a custom role but not a system role', async () => {
      const custom = await h.http().put('/api/roles/night_shift').set(h.as('owner_A')).send({ name: 'Late shift', permissions: ['leads.work'] });
      expect(custom.body.name).toBe('Late shift');
      const system = await h.http().put('/api/roles/sales').set(h.as('owner_A')).send({ name: 'Renamed', permissions: ['leads.work'] });
      expect(system.body.name).toBe('Sales');
      expect((await h.db.getRepository(Role).findOneByOrFail({ company_id: ids.A, key: 'sales' })).name).toBe('Sales'); // and nothing was stored
    });

    it('the owner role cannot be changed', async () => {
      const res = await h.http().put('/api/roles/owner').set(h.as('owner_A')).send({ permissions: ['leads.work'] });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('OWNER_ROLE_LOCKED');
      expect((await roleRows(ids.A)).map((r) => r.key)).not.toContain('owner');
    });

    it('rejects unknown roles (404) and invalid permission lists (400)', async () => {
      expect((await h.http().put('/api/roles/nope').set(h.as('owner_A')).send({ permissions: [] })).status).toBe(404);
      expect((await h.http().put('/api/roles/sales').set(h.as('owner_A')).send({ permissions: ['no.such'] })).status).toBe(400);
      expect((await h.http().put('/api/roles/sales').set(h.as('owner_A')).send({})).status).toBe(400);
    });

    it('is refused to members without roles.manage', async () => {
      for (const w of ['admin_A', 'team_lead_A', 'sales_A']) {
        expect((await h.http().put('/api/roles/sales').set(h.as(w)).send({ permissions: [] })).status).toBe(403);
      }
    });

    it("another company's owner cannot change this company's roles (keys are per company)", async () => {
      await h.http().put('/api/roles/night_shift').set(h.as('owner_B')).send({ permissions: ['leads.work', 'reports.view', 'finance.view'] });
      expect(sorted((await h.get('owner_A', '/roles/night_shift')).body.permissions)).toEqual(['leads.work']);
    });
  });

  describe('nobody grants what they do not hold', () => {
    beforeAll(async () => {
      // company B: admins may manage roles but hold no billing or finance permission
      await h.http().put('/api/roles/admin').set(h.as('owner_B')).send({ permissions: ['leads.work', 'roles.view', 'roles.manage', 'accounts.view'] });
    });

    it('a role manager cannot create a role carrying permissions they lack', async () => {
      const res = await h.post('admin_B', '/roles', { key: 'cashier', name: 'Cashier', permissions: ['leads.work', 'billing.manage'] });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PERMISSION_ESCALATION');
      expect((await h.post('admin_B', '/roles', { key: 'cashier', name: 'Cashier', permissions: ['leads.work'] })).status).toBe(201);
    });

    it('nor add such a permission to an existing role', async () => {
      const res = await h.http().put('/api/roles/sales').set(h.as('admin_B')).send({ permissions: ['leads.work', 'finance.manage'] });
      expect(res.status).toBe(403);
    });

    it('but may remove permissions, including ones they do not hold themselves', async () => {
      await h.http().put('/api/roles/team_lead').set(h.as('owner_B')).send({ permissions: ['leads.work', 'finance.view'] });
      const res = await h.http().put('/api/roles/team_lead').set(h.as('admin_B')).send({ permissions: ['leads.work'] });
      expect(res.status).toBe(200);
      expect(res.body.permissions).toEqual(['leads.work']);
    });

    it('resetting a role to its defaults is granting too: refused when the defaults exceed what the caller holds', async () => {
      // team_lead of company B was cut down to ['leads.work'] above; its defaults carry permissions admin_B lacks
      const res = await h.del('admin_B', '/roles/team_lead');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PERMISSION_ESCALATION');
      expect((await h.get('owner_B', '/roles/team_lead')).body.customized).toBe(true);
      expect((await h.del('owner_B', '/roles/team_lead')).status).toBe(200); // the owner holds everything
    });

    it("and cannot lift their own role to something larger", async () => {
      const res = await h.http().put('/api/roles/admin').set(h.as('admin_B')).send({ permissions: PERMISSION_KEYS });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /roles/:key', () => {
    it('refuses to delete a custom role that members still hold', async () => {
      const m = await h.db.getRepository(CompanyMembership).findOneByOrFail({ company_id: ids.A, user_id: ids.team_lead_A });
      await h.patch('owner_A', `/company-memberships/${m.id}`, { role: 'night_shift' });
      const res = await h.del('owner_A', '/roles/night_shift');
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ROLE_IN_USE');
      await h.patch('owner_A', `/company-memberships/${m.id}`, { role: 'team_lead' });
    });

    it('deletes an unused custom role', async () => {
      expect((await h.del('owner_A', '/roles/dupes')).status).toBe(200);
      expect((await h.get('owner_A', '/roles/dupes')).status).toBe(404);
      expect((await roleRows(ids.A)).map((r) => r.key)).not.toContain('dupes');
    });

    it("deleting a customised system role resets it to the defaults (and keeps its members)", async () => {
      await h.http().put('/api/roles/team_lead').set(h.as('owner_A')).send({ permissions: ['leads.work'] });
      expect((await h.get('team_lead_A', '/auth/me')).body.permissions).toEqual(['leads.work']);
      const res = await h.del('owner_A', '/roles/team_lead');
      expect(res.status).toBe(200);
      expect(sorted((await h.get('team_lead_A', '/auth/me')).body.permissions)).toEqual(sorted(systemRole('team_lead')!.permissions));
      expect((await h.get('owner_A', '/roles/team_lead')).body.customized).toBe(false);
    });

    it('the owner role cannot be deleted; unknown roles are 404; others are refused', async () => {
      expect((await h.del('owner_A', '/roles/owner')).status).toBe(403);
      expect((await h.del('owner_A', '/roles/nope')).status).toBe(404);
      for (const w of ['admin_A', 'team_lead_A', 'sales_A']) expect((await h.del(w, '/roles/night_shift')).status).toBe(403);
    });

    it("deleting a role in one company leaves the same key in another", async () => {
      await h.del('owner_B', '/roles/night_shift');
      expect((await h.get('owner_A', '/roles/night_shift')).status).toBe(200);
    });
  });

  describe('subscription state', () => {
    it('an expired company owner can read roles but not change them (read-only owner)', async () => {
      expect((await h.get('owner_X', '/roles')).status).toBe(200);
      const res = await h.post('owner_X', '/roles', { key: 'late_role', name: 'Late', permissions: [] });
      expect([402, 403]).toContain(res.status);
      expect((await roleRows(ids.X)).length).toBe(0);
    });
  });

  it('system role definitions in the response always match the code catalogue', async () => {
    const list = (await h.get('owner_B', '/roles')).body.filter((r: any) => r.is_system && !r.customized);
    for (const r of list) expect(sorted(r.permissions)).toEqual(sorted(SYSTEM_ROLES.find((s) => s.key === r.key)!.permissions));
  });
});
