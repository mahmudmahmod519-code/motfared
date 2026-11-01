import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionRequirement, REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { hasPermission, isPlatformAdmin } from '../tenant/tenant-scope';

/**
 * Checks `@RequirePermission(...)` against `request.user.permissions`, which JwtStrategy resolves
 * from the database on every request (never from the token or the client). Routes without the
 * decorator are untouched, so this can sit in the standard guard chain.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.permissions.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Access denied');
    if (isPlatformAdmin(user)) {
      if (required.platformAdmin) return true;
      throw new ForbiddenException({ message: 'Platform admins cannot use this company route', code: 'PERMISSION_DENIED' });
    }

    const missing = required.permissions.find((p) => !hasPermission(user, p));
    if (missing) {
      throw new ForbiddenException({ message: `Missing permission: ${missing}`, code: 'PERMISSION_DENIED', permission: missing });
    }
    return true;
  }
}
