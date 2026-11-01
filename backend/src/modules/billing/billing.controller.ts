import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { CreateManualPaymentRequestDto } from './dto/create-manual-payment-request.dto';
import { ApproveManualPaymentRequestDto, RejectManualPaymentRequestDto } from './dto/review-manual-payment-request.dto';
import { ManualPaymentStatus } from './entities/manual-payment-request.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission, RequirePermissionOrPlatform } from '../../common/decorators/require-permission.decorator';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { listScope, tenantScope, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';
import { Entitlement } from '../../common/decorators/entitlement.decorator';

@Controller('billing/manual-requests')
@TenantApi()
@Entitlement('billing') // reachable while the subscription is lapsed so the company can pay
export class BillingController {
  constructor(private readonly service: BillingService) {}

  // Only a company's CEO can claim a payment, and only for their own company.
  @Post()
  @RequirePermission('billing.manage')
  create(@Body() dto: CreateManualPaymentRequestDto, @Tenant() user: TenantPrincipal) {
    return this.service.create(tenantScope(user) as string, user.id, dto);
  }

  @Get()
  @RequirePermissionOrPlatform('billing.view')
  findAll(@Query('company_id') companyId: string, @Query('status') status: ManualPaymentStatus, @Tenant() user: TenantPrincipal) {
    return this.service.findAll(listScope(user, companyId), status);
  }

  @Get(':id')
  @RequirePermissionOrPlatform('billing.view')
  findOne(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.findOne(id, tenantScope(user));
  }

  @Post(':id/approve')
  @Roles('platform_admin')
  approve(@Param('id') id: string, @Body() dto: ApproveManualPaymentRequestDto, @Tenant() user: TenantPrincipal) {
    return this.service.approve(id, user.id, dto.note);
  }

  @Post(':id/reject')
  @Roles('platform_admin')
  reject(@Param('id') id: string, @Body() dto: RejectManualPaymentRequestDto, @Tenant() user: TenantPrincipal) {
    return this.service.reject(id, user.id, dto.note);
  }
}
