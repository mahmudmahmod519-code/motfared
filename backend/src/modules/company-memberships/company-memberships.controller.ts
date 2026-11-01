import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { CompanyMembershipsService } from './company-memberships.service';
import { CreateCompanyMembershipDto } from './dto/create-company-membership.dto';
import { UpdateCompanyMembershipDto } from './dto/update-company-membership.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissionOrPlatform } from '../../common/decorators/require-permission.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';

@Controller('company-memberships')
@TenantApi()
export class CompanyMembershipsController {
  constructor(private readonly service: CompanyMembershipsService) {}

  @Post()
  @RequirePermissionOrPlatform('accounts.manage')
  create(@Body() dto: CreateCompanyMembershipDto, @Tenant() user: TenantPrincipal) {
    dto.company_id = writeCompany(user, dto.company_id);
    return this.service.create(dto, tenantScope(user), user);
  }

  @Get()
  @RequirePermissionOrPlatform('accounts.view')
  findAll(@Query('company_id') companyId: string, @Tenant() user: TenantPrincipal) {
    return this.service.findAll(listScope(user, companyId));
  }

  @Get(':id')
  @RequirePermissionOrPlatform('accounts.view')
  findOne(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.findOne(id, tenantScope(user));
  }

  @Patch(':id')
  @RequirePermissionOrPlatform('accounts.manage')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyMembershipDto, @Tenant() user: TenantPrincipal) {
    return this.service.update(id, dto, tenantScope(user), user);
  }

  @Delete(':id')
  @RequirePermissionOrPlatform('accounts.manage')
  remove(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.remove(id, tenantScope(user), user);
  }
}
