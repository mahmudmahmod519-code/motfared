import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantPrincipal } from '../tenant/tenant-scope';
import type { Entitlement } from '../../modules/subscriptions/entitlement.service';

/** One field of the principal: `@CurrentUser('id') userId: string`. */
export const CurrentUser = createParamDecorator((data: keyof TenantPrincipal | undefined, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest().user;
  return data ? user?.[data] : user;
});

/** The whole principal of the request: `@Tenant() user: TenantPrincipal`. */
export const Tenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantPrincipal => ctx.switchToHttp().getRequest().user);

/**
 * The subscription state SubscriptionGuard already resolved for this request (undefined for platform
 * admins and on routes outside @TenantApi), so handlers never look it up a second time.
 */
export const CurrentEntitlement = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Entitlement | undefined => ctx.switchToHttp().getRequest().entitlement,
);
