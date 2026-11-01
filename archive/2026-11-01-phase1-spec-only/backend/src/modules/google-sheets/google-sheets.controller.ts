import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';

@Controller('google-sheets')
@TenantApi()
export class GoogleSheetsController {
  constructor(private readonly service: GoogleSheetsService) {}

  @Post('sync/:leadId')
  @Roles('platform_admin', 'owner', 'admin')
  sync(@Param('leadId') leadId: string, @Tenant() user: TenantPrincipal) {
    return this.service.syncSheet(leadId, tenantScope(user));
  }

  @Post('import/:leadId')
  @Roles('platform_admin', 'owner', 'admin')
  importRows(
    @Param('leadId') leadId: string,
    @Body('rows') rows: Array<{ name: string; phone: string; email?: string; external_row_id: string }>,
    @Tenant() user: TenantPrincipal,
  ) {
    return this.service.importMockRows(leadId, rows || [], tenantScope(user));
  }
}
