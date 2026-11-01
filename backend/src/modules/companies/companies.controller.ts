import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissionOrPlatform } from '../../common/decorators/require-permission.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';
import { Entitlement } from '../../common/decorators/entitlement.decorator';

@Controller('companies')
@TenantApi()
@Entitlement('billing') // reachable while the subscription is lapsed so the company can pay
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Post()
  @Roles('platform_admin')
  create(@Body() dto: CreateCompanyDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Tenant() user: TenantPrincipal) {
    return this.service.findAll(tenantScope(user));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.findOne(id, tenantScope(user));
  }

  @Patch(':id')
  @RequirePermissionOrPlatform('settings.manage')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto, @Tenant() user: TenantPrincipal) {
    return this.service.update(id, dto, tenantScope(user));
  }

  @Delete(':id')
  @Roles('platform_admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
