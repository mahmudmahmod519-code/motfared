/**
 * Phase 1 — roles and permissions: the catalogue lives in the database, system roles have
 * defaults, a company can override them, and the resolved permissions come from the database
 * on every request. Written before the implementation.
 */
import { bootstrap } from './harness';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { Permission } from '../../src/modules/rbac/entities/permission.entity';
import { Role } from '../../src/modules/rbac/entities/role.entity';
import { RolePermission } from '../../src/modules/rbac/entities/role-permission.entity';
import { PERMISSIONS, PERMISSION_KEYS, systemRole } from '../../src/modules/rbac/permissions.catalogue';
import { CompanyMembership } from '../../src/modules/company-memberships/entities/company-membership.entity';

describe('RBAC model', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  let rbac: RbacService;
  const ids: Record<string, string> = {};

  const override = async (companyId: string, key: string, perms: string[], extra: Partial<Role> = {}) => {
    const role = await h.db.getRepository(Role).save({ company_id: companyId, key, name: key, is_system: ['sales', 'admin', 'team_lead', 'owner'].includes(key), ...extra } as any);
    for (const permission_key of perms) await h.db.getRepository(RolePermission).save({ role_id: role.id, permission_key });
    return role;
  };

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    rbac = h.app.get(RbacService);
    const A = await h.mkCompany('RBAC A');
    const B = await h.mkCompany('RBAC B');
    Object.assign(ids, { A: A.id, B: B.id });
    ids.ownerA = (await h.mkUser('Owner A', 'owner-a@r.test', A.id, 'owner')).id;
    ids.salesA = (await h.mkUser('Sales A', 'sales-a@r.test', A.id, 'sales')).id;
    ids.leadA = (await h.mkUser('Lead A', 'lead-a@r.test', A.id, 'team_lead')).id;
    ids.salesB = (await h.mkUser('Sales B', 'sales-b@r.test', B.id, 'sales')).id;
    ids.admin = (await h.mkUser('Platform', 'platform@r.test', null, undefined, 'platform_admin')).id;
    ids.nomember = (await h.mkUser('Nomember', 'nm@r.test', A.id)).id;
    for (const [k, id] of Object.entries({ ownerA: ids.ownerA, salesA: ids.salesA, leadA: ids.leadA, salesB: ids.salesB, admin: ids.admin, nomember: ids.nomember })) h.tokenFor(k, id);
  });
  afterAll(async () => { await h.app?.close(); });

  describe('catalogue in the database', () => {
    it('matches the code catalogue exactly (adding a permission needs a migration)', async () => {
      const rows = await h.db.getRepository(Permission).find();
      const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key);
      expect(rows.map((r) => ({ key: r.key, group: r.group_name, description: r.description })).sort(byKey)).toEqual(
        [...PERMISSIONS].sort(byKey),
      );
    });

    it('role_permissions only references catalogue keys (foreign key)', async () => {
      await expect(
        h.db.getRepository(RolePermission).save({ role_id: (await override(ids.B, 'fk_probe', [])).id, permission_key: 'no.such_permission' }),
      ).rejects.toThrow();
    });
  });

  describe('permissionsFor', () => {
    it.each(['sales', 'team_lead', 'admin', 'owner'])('%s gets its defaults when the company has no override', async (key) => {
      expect((await rbac.permissionsFor(ids.A, key)).sort()).toEqual([...systemRole(key)!.permissions].sort());
    });

    it('an unknown role, or none, has no permissions', async () => {
      expect(await rbac.permissionsFor(ids.A, 'made_up')).toEqual([]);
      expect(await rbac.permissionsFor(ids.A, undefined as any)).toEqual([]);
      expect(await rbac.permissionsFor(undefined as any, 'owner')).toEqual([]);
    });

    it("a company's override replaces the defaults for that company only", async () => {
      await override(ids.A, 'sales', ['leads.work', 'dashboard.view']);
      expect((await rbac.permissionsFor(ids.A, 'sales')).sort()).toEqual(['dashboard.view', 'leads.work']);
      expect((await rbac.permissionsFor(ids.B, 'sales')).sort()).toEqual(['leads.work']); // company B untouched
    });

    it('an override may remove every permission (the role then does nothing)', async () => {
      await override(ids.B, 'team_lead', []);
      expect(await rbac.permissionsFor(ids.B, 'team_lead')).toEqual([]);
      expect((await rbac.permissionsFor(ids.A, 'team_lead')).length).toBeGreaterThan(1);
    });

    it('the owner always holds every permission, whatever an override says (no lock-out)', async () => {
      await override(ids.A, 'owner', ['leads.work']);
      expect((await rbac.permissionsFor(ids.A, 'owner')).sort()).toEqual([...PERMISSION_KEYS].sort());
    });

    it("a custom role resolves in its own company and means nothing in another", async () => {
      await override(ids.A, 'night_shift', ['leads.work', 'reports.view'], { name: 'Night shift', is_system: false });
      expect((await rbac.permissionsFor(ids.A, 'night_shift')).sort()).toEqual(['leads.work', 'reports.view']);
      expect(await rbac.permissionsFor(ids.B, 'night_shift')).toEqual([]);
    });
  });

  describe('per-request resolution', () => {
    it('/auth/me returns the permissions resolved now, from the database', async () => {
      const me = await h.get('salesA', '/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.role).toBe('sales');
      expect([...me.body.permissions].sort()).toEqual(['dashboard.view', 'leads.work']); // company A's override
      const b = await h.get('salesB', '/auth/me');
      expect(b.body.permissions).toEqual(['leads.work']);
    });

    it('a change of role takes effect on the very next request', async () => {
      await h.db.getRepository(CompanyMembership).update({ company_id: ids.A, user_id: ids.leadA }, { role: 'night_shift' });
      expect([...(await h.get('leadA', '/auth/me')).body.permissions].sort()).toEqual(['leads.work', 'reports.view']);
      await h.db.getRepository(CompanyMembership).update({ company_id: ids.A, user_id: ids.leadA }, { role: 'team_lead' });
      expect((await h.get('leadA', '/auth/me')).body.permissions).toContain('leads.manage');
    });

    it('editing a role changes the next request of everyone who holds it', async () => {
      const role = await h.db.getRepository(Role).findOneByOrFail({ company_id: ids.A, key: 'sales' });
      await h.db.getRepository(RolePermission).delete({ role_id: role.id, permission_key: 'dashboard.view' });
      expect((await h.get('salesA', '/auth/me')).body.permissions).toEqual(['leads.work']);
    });

    it('a user without a membership, and a platform admin, carry no company permissions', async () => {
      expect((await h.get('nomember', '/auth/me')).body.permissions).toEqual([]);
      expect((await h.get('admin', '/auth/me')).body.permissions).toEqual([]);
    });
  });
});
