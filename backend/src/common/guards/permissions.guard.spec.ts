import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);
  const ctx = (user: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => handler,
      getClass: () => Cls,
    }) as unknown as ExecutionContext;
  let handler: any;
  class Cls {}
  const require = (meta: any) => jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(meta);

  afterEach(() => jest.restoreAllMocks());

  it('lets everything through when the route declares no permission', () => {
    require(undefined);
    expect(guard.canActivate(ctx({ permissions: [] }))).toBe(true);
  });

  it('allows a member holding the permission', () => {
    require({ permissions: ['leads.work'], platformAdmin: false });
    expect(guard.canActivate(ctx({ company_id: 'c', permissions: ['leads.work'] }))).toBe(true);
  });

  it('denies a member without it, naming the missing permission and a stable code', () => {
    require({ permissions: ['billing.manage'], platformAdmin: false });
    try {
      guard.canActivate(ctx({ company_id: 'c', permissions: ['leads.work'] }));
      fail('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect(e.getResponse()).toMatchObject({ code: 'PERMISSION_DENIED', permission: 'billing.manage' });
    }
  });

  it('requires every listed permission', () => {
    require({ permissions: ['leads.work', 'reports.view'], platformAdmin: false });
    expect(() => guard.canActivate(ctx({ permissions: ['leads.work'] }))).toThrow(ForbiddenException);
    expect(guard.canActivate(ctx({ permissions: ['reports.view', 'leads.work'] }))).toBe(true);
  });

  it('denies a request with no user or no permission list', () => {
    require({ permissions: ['leads.work'], platformAdmin: false });
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx({}))).toThrow(ForbiddenException);
  });

  it('a platform admin passes only on routes that explicitly admit them', () => {
    const pa = { platform_role: 'platform_admin', permissions: [] };
    require({ permissions: ['billing.view'], platformAdmin: false });
    expect(() => guard.canActivate(ctx(pa))).toThrow(ForbiddenException);
    require({ permissions: ['billing.view'], platformAdmin: true });
    expect(guard.canActivate(ctx(pa))).toBe(true);
  });

  it('admitting platform admins does not weaken the check for members', () => {
    require({ permissions: ['billing.view'], platformAdmin: true });
    expect(() => guard.canActivate(ctx({ company_id: 'c', permissions: [] }))).toThrow(ForbiddenException);
  });

  it('a user who merely claims a permission in a spoofed field is not trusted: only `permissions` counts', () => {
    require({ permissions: ['billing.manage'], platformAdmin: false });
    expect(() => guard.canActivate(ctx({ role: 'owner', permissions: [] }))).toThrow(ForbiddenException);
  });
});
