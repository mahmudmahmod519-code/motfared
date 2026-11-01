import { Controller, Get, Param, ParseIntPipe, Query, UseFilters } from '@nestjs/common';
import { MobileLeadsService } from './mobile-leads.service';
import { TenantApi } from '../../../common/decorators/tenant-api.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Tenant } from '../../../common/decorators/current-user.decorator';
import { MobileExceptionFilter } from '../../../common/filters/mobile-exception.filter';
import { tenantScope, TenantPrincipal } from '../../../common/tenant/tenant-scope';

/**
 * Lead reads for the Android app, on the legacy paths and shapes. Company-scoped (@TenantApi gives
 * authentication, roles and the subscription rules); a rep only ever reaches their own leads.
 */
@Controller('mobile')
@TenantApi()
@RequirePermission('leads.work') // the rep's own work surface; custom roles must be granted it
@UseFilters(MobileExceptionFilter)
export class MobileLeadsController {
  constructor(private readonly service: MobileLeadsService) {}

  @Get('leads')
  list(@Tenant() user: TenantPrincipal) {
    return this.service.list(tenantScope(user) as string, user.id);
  }

  // Declared before `leads/:id`, so "history" is never read as an id.
  @Get('leads/history')
  history(@Query('q') q: string, @Query('page') page: string, @Query('pageSize') pageSize: string, @Tenant() user: TenantPrincipal) {
    return this.service.history(tenantScope(user) as string, user.id, { q, page, pageSize });
  }

  @Get('leads/:id')
  get(@Param('id', ParseIntPipe) id: number, @Tenant() user: TenantPrincipal) {
    return this.service.get(tenantScope(user) as string, user.id, id);
  }

  @Get('leads/:id/activity')
  activity(@Param('id', ParseIntPipe) id: number, @Tenant() user: TenantPrincipal) {
    return this.service.activity(tenantScope(user) as string, user.id, id);
  }

  @Get('my/doctors')
  doctors(@Tenant() user: TenantPrincipal) {
    return this.service.doctors(tenantScope(user) as string, user.id);
  }

  @Get('services')
  services(@Tenant() user: TenantPrincipal) {
    return this.service.servicesList(tenantScope(user) as string);
  }
}
