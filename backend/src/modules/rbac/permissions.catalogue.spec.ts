import { OWNER_KEY, PERMISSION_KEYS, PERMISSIONS, SYSTEM_ROLES, SYSTEM_ROLE_KEYS, systemRole } from './permissions.catalogue';

describe('permission catalogue', () => {
  it('has unique, dotted, lower-case keys with descriptions', () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    for (const p of PERMISSIONS) {
      expect(p.key).toMatch(/^[a-z_]+\.[a-z_]+$/);
      expect(p.description.length).toBeGreaterThan(10);
      expect(p.group.length).toBeGreaterThan(0);
    }
  });

  it('defines exactly the four approved system roles', () => {
    expect(SYSTEM_ROLE_KEYS.sort()).toEqual(['admin', 'owner', 'sales', 'team_lead']);
  });

  it('only grants permissions that exist', () => {
    for (const r of SYSTEM_ROLES) for (const k of r.permissions) expect(PERMISSION_KEYS).toContain(k);
  });

  it('owner holds every permission', () => {
    expect([...systemRole(OWNER_KEY)!.permissions].sort()).toEqual([...PERMISSION_KEYS].sort());
  });

  it('follows the legacy hierarchy: sales ⊂ team_lead ⊂ admin ⊂ owner, each step strictly larger', () => {
    const chain = ['sales', 'team_lead', 'admin', 'owner'].map((k) => new Set(systemRole(k)!.permissions));
    for (let i = 1; i < chain.length; i++) {
      for (const k of chain[i - 1]) expect(chain[i].has(k)).toBe(true);
      expect(chain[i].size).toBeGreaterThan(chain[i - 1].size);
    }
  });

  it('keeps the legacy rules: sales has no dashboard; team lead is not cross-team; admin cannot manage roles, billing or privileged accounts', () => {
    expect(systemRole('sales')!.permissions).not.toContain('dashboard.view');
    expect(systemRole('team_lead')!.permissions).toContain('dashboard.view');
    expect(systemRole('team_lead')!.permissions).not.toContain('scope.all_teams');
    expect(systemRole('team_lead')!.permissions).not.toContain('uploads.manage');
    for (const k of ['roles.manage', 'billing.manage', 'accounts.admin', 'accounts.unrestrict', 'data.backup']) {
      expect(systemRole('admin')!.permissions).not.toContain(k);
      expect(systemRole('owner')!.permissions).toContain(k);
    }
  });

  it('does not share the arrays of the roles (mutating one must not change another)', () => {
    expect(systemRole('sales')!.permissions).not.toBe(systemRole('team_lead')!.permissions);
  });
});
