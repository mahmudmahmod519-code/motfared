/**
 * Unit Tests - JWT Auth Guard
 */

import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should extend AuthGuard(jwt)', () => {
    expect(guard).toBeInstanceOf(require('@nestjs/passport').AuthGuard('jwt'));
  });
});

/**
 * Unit Tests - Roles Guard
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no roles required', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'owner' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has required role', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'owner' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['owner']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user lacks required role', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'sales' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['owner', 'admin']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should deny access when no user', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: null }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['owner']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

/**
 * Unit Tests - Company Guard
 */

import { CompanyGuard } from './company.guard';

describe('CompanyGuard', () => {
  let guard: CompanyGuard;

  beforeEach(() => {
    guard = new CompanyGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow platform admin', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { platform_role: 'platform_admin', company_id: 'company-1' },
        }),
      }),
      getRequest: () => ({
        user: { platform_role: 'platform_admin', company_id: 'company-1' },
        params: {},
      }),
    } as any;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow user accessing own company', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { platform_role: 'owner', company_id: 'company-1' },
          params: { company_id: 'company-1' },
        }),
      }),
    } as any;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny user accessing different company', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { platform_role: 'owner', company_id: 'company-1' },
          params: { company_id: 'company-2' },
        }),
      }),
    } as any;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should deny unauthenticated user', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: null }),
      }),
    } as any;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
