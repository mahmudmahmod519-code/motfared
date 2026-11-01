import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { SubscriptionProviderRefsService } from './subscription-provider-refs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';
import { Entitlement } from '../../common/decorators/entitlement.decorator';

@Controller('subscription-provider-refs')
@TenantApi()
@Entitlement('billing') // reachable while the subscription is lapsed so the company can pay
export class SubscriptionProviderRefsController {
  constructor(private readonly service: SubscriptionProviderRefsService) {}

  @Post()
  @Roles('platform_admin')
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Get()
  @Roles('platform_admin')
  findAll(@Query('subscription_id') subscriptionId?: string) {
    return this.service.findAll(subscriptionId);
  }
}
