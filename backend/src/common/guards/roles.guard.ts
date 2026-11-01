import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    // Check platform_role first, then membership role
    const userRole = user.platform_role || user.role;
    if (!userRole) {
      throw new ForbiddenException('No role assigned');
    }

    const hasRole = requiredRoles.some((r) => r === userRole);
    if (!hasRole) {
      throw new ForbiddenException(`Role '${userRole}' is not allowed. Required: ${requiredRoles.join(', ')}`);
    }
    return true;
  }
}
