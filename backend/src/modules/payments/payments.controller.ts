import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissionOrPlatform } from '../../common/decorators/require-permission.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';
import { Entitlement } from '../../common/decorators/entitlement.decorator';

@Controller('payments')
@TenantApi()
@Entitlement('billing') // reachable while the subscription is lapsed so the company can pay
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post()
  @Roles('platform_admin')
  create(@Body() dto: CreatePaymentDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissionOrPlatform('billing.view')
  findAll(@Query('subscription_id') subscriptionId: string, @Tenant() user: TenantPrincipal) {
    return this.service.findAll(subscriptionId, tenantScope(user));
  }

  @Get(':id')
  @RequirePermissionOrPlatform('billing.view')
  findOne(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.findOne(id, tenantScope(user));
  }
}
