import { CanActivate, ExecutionContext, ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ENTITLEMENT_KEY, EntitlementRequirement } from '../decorators/entitlement.decorator';
import { isPlatformAdmin } from '../tenant/tenant-scope';
import { EntitlementService } from '../../modules/subscriptions/entitlement.service';
import { RESTRICTION, allowedFor } from '../../modules/subscriptions/entitlement';

/**
 * Authoritative subscription enforcement. Runs after JwtAuthGuard/RolesGuard, resolves the
 * company's state from the database for every request and applies the entitlement matrix.
 * Platform admins (support) are not subject to a tenant's subscription.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const user = req.user;
    if (isPlatformAdmin(user)) return true;
    if (!user?.company_id) throw new ForbiddenException('No company is associated with this account');

    const required =
      this.reflector.getAllAndOverride<EntitlementRequirement>(ENTITLEMENT_KEY, [context.getHandler(), context.getClass()]) ??
      (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? 'read' : 'write');

    const ent = await this.entitlements.resolve(user.company_id, user.role);
    req.entitlement = ent; // handlers read it with @CurrentEntitlement() instead of resolving again
    res.setHeader('X-Subscription-State', ent.state);
    if (ent.grace_until) res.setHeader('X-Subscription-Grace-Until', ent.grace_until.toISOString());

    const allowed = allowedFor(ent.state, user.role);
    // The owner of a lapsed company reads read-only: tell the client so it can show a "renew" banner.
    if (allowed.read && !allowed.write) res.setHeader('X-Subscription-Read-Only', 'true');
    if (required === 'always' || allowed[required]) return true;

    const r = RESTRICTION[ent.state]!;
    throw new HttpException(
      { statusCode: r.status, error: 'SubscriptionRestricted', code: r.code, message: r.message, subscription_state: ent.state, required, read_only: allowed.read && !allowed.write },
      r.status,
    );
  }
}
