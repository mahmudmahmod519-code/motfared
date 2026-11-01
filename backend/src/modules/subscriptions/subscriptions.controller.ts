import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissionOrPlatform } from '../../common/decorators/require-permission.decorator';
import { CurrentEntitlement, Tenant } from '../../common/decorators/current-user.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';
import { Entitlement } from '../../common/decorators/entitlement.decorator';
import { EntitlementService, Entitlement as ResolvedEntitlement } from './entitlement.service';
import { RESTRICTION } from './entitlement';

@Controller('subscriptions')
@TenantApi()
@Entitlement('billing') // reachable while the subscription is lapsed so the company can pay
export class SubscriptionsController {
  constructor(
    private readonly service: SubscriptionsService,
    private readonly entitlements: EntitlementService,
  ) {}

  // A tenant must never be able to write its own entitlement: create/update/delete are
  // platform-admin only. Paid state is set by verified payment events or an admin
  // approving a manual payment (Phase 3).
  @Post()
  @Roles('platform_admin')
  create(@Body() dto: CreateSubscriptionDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissionOrPlatform('billing.view')
  findAll(@Query('company_id') queryCompanyId: string, @Tenant() user: TenantPrincipal) {
    return this.service.findAll(listScope(user, queryCompanyId));
  }

  // Reachable in every state (even suspended) so web and mobile can show why access is limited.
  // Always the caller's own company: no company id is accepted from the client.
  @Get('status')
  @Entitlement('always')
  async status(@CurrentEntitlement() resolved: ResolvedEntitlement | undefined) {
    // Platform admins skip the guard's lookup and belong to no company: their state is 'none'.
    const ent = resolved ?? (await this.entitlements.resolve(null));
    const r = RESTRICTION[ent.state];
    return { ...ent, code: r?.code };
  }

  @Get('current')
  getCurrent(@Tenant() user: TenantPrincipal) {
    const scope = tenantScope(user);
    return scope ? this.service.findCurrentByCompany(scope) : null;
  }

  @Get(':id')
  @RequirePermissionOrPlatform('billing.view')
  findOne(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.findOne(id, tenantScope(user));
  }

  @Patch(':id')
  @Roles('platform_admin')
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissionOrPlatform('billing.manage')
  cancel(@Param('id') id: string, @Body('at_period_end') atPeriodEnd: boolean, @Tenant() user: TenantPrincipal) {
    return this.service.cancel(id, atPeriodEnd ?? true, tenantScope(user));
  }

  @Delete(':id')
  @Roles('platform_admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
