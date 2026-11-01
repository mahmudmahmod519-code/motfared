import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { SubscriptionGuard } from '../guards/subscription.guard';

/**
 * Standard protection for every company-scoped controller: authenticated, role- and permission-checked and
 * subject to the company's subscription entitlements. A coverage test fails if a controller
 * is neither decorated with this nor on the explicit exemption list.
 */
export const TenantApi = () => applyDecorators(UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, SubscriptionGuard));
