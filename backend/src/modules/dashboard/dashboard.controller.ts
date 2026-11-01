import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, hasPermission, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';

@Controller('dashboard')
@TenantApi()
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('stats')
  async getStats(@Tenant() user: TenantPrincipal) {
    if (isPlatformAdmin(user)) {
      return this.service.getAdminStats();
    }
    const companyId = tenantScope(user);
    // Members whose role lacks dashboard.view (the sales role by default) see only their own figures.
    if (!hasPermission(user, 'dashboard.view')) {
      return this.service.getCallCenterStats(companyId, user.id);
    }
    return this.service.getCompanyStats(companyId);
  }
}
