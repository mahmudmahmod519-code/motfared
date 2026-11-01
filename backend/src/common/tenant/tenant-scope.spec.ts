import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { hasPermission, isPlatformAdmin, listScope, tenantScope, writeCompany } from './tenant-scope';

describe('tenant scope helpers', () => {
  const member = { id: 'u', company_id: 'A', role: 'sales', permissions: ['leads.work'] };
  const platform = { id: 'p', platform_role: 'platform_admin' as const, permissions: [] };

  it('isPlatformAdmin is true only for the exact platform role', () => {
    expect(isPlatformAdmin(platform)).toBe(true);
    expect(isPlatformAdmin(member)).toBe(false);
    expect(isPlatformAdmin({ platform_role: 'Platform_Admin' } as any)).toBe(false);
    expect(isPlatformAdmin(undefined)).toBe(false);
  });

  it("tenantScope is the member's own company, undefined for platform admins, and never 'all' by accident", () => {
    expect(tenantScope(member)).toBe('A');
    expect(tenantScope(platform)).toBeUndefined();
    expect(() => tenantScope({ id: 'x', permissions: [] })).toThrow(ForbiddenException);
    expect(() => tenantScope(undefined)).toThrow(ForbiddenException);
    expect(() => tenantScope({ id: 'x', company_id: '' } as any)).toThrow(ForbiddenException);
  });

  it('listScope ignores a requested company for members and honours it for platform admins', () => {
    expect(listScope(member, 'B')).toBe('A');
    expect(listScope(platform, 'B')).toBe('B');
    expect(listScope(platform)).toBeUndefined();
  });

  it('writeCompany stamps the member\'s own company; platform admins must name one', () => {
    expect(writeCompany(member, 'B')).toBe('A');
    expect(writeCompany(platform, 'B')).toBe('B');
    expect(() => writeCompany(platform)).toThrow(BadRequestException);
  });

  describe('hasPermission', () => {
    it('is true only when the permission is on the principal', () => {
      expect(hasPermission(member, 'leads.work')).toBe(true);
      expect(hasPermission(member, 'billing.manage')).toBe(false);
    });
    it('trusts nothing but `permissions`: a role name or a platform role grants nothing', () => {
      expect(hasPermission({ role: 'owner', permissions: [] } as any, 'billing.manage')).toBe(false);
      expect(hasPermission(platform, 'billing.manage')).toBe(false);
    });
    it('copes with a missing principal or a missing list', () => {
      expect(hasPermission(undefined, 'leads.work')).toBe(false);
      expect(hasPermission({ id: 'u' } as any, 'leads.work')).toBe(false);
      expect(hasPermission({ id: 'u', permissions: 'leads.work' } as any, 'leads.work')).toBe(false);
    });
  });
});
