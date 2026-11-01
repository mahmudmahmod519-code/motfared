import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { BillingCustomersService } from './billing-customers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissionOrPlatform } from '../../common/decorators/require-permission.decorator';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';
import { Entitlement } from '../../common/decorators/entitlement.decorator';

@Controller('billing-customers')
@TenantApi()
@Entitlement('billing') // reachable while the subscription is lapsed so the company can pay
export class BillingCustomersController {
  constructor(private readonly service: BillingCustomersService) {}

  @Post()
  @RequirePermissionOrPlatform('billing.manage')
  create(
    @Body() data: { company_id: string; provider: string; provider_customer_id: string },
    @Tenant() user: TenantPrincipal,
  ) {
    data.company_id = writeCompany(user, data?.company_id);
    return this.service.create(data);
  }

  @Get()
  @RequirePermissionOrPlatform('billing.view')
  findAll(@Query('company_id') queryCompanyId: string, @Tenant() user: TenantPrincipal) {
    return this.service.findAll(listScope(user, queryCompanyId));
  }
}
