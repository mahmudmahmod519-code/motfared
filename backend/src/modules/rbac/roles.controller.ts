import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { tenantScope, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

/** Company-scoped role and permission management. Platform admins act on a company's roles only through the company's own owner. */
@Controller()
@TenantApi()
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get('permissions')
  @RequirePermission('roles.view')
  catalogue() {
    return this.service.catalogue();
  }

  @Get('roles')
  @RequirePermission('roles.view')
  list(@Tenant() user: TenantPrincipal) {
    return this.service.list(tenantScope(user) as string);
  }

  @Get('roles/:key')
  @RequirePermission('roles.view')
  get(@Param('key') key: string, @Tenant() user: TenantPrincipal) {
    return this.service.get(tenantScope(user) as string, key);
  }

  @Post('roles')
  @RequirePermission('roles.manage')
  create(@Body() dto: CreateRoleDto, @Tenant() user: TenantPrincipal) {
    return this.service.create(user, tenantScope(user) as string, dto);
  }

  @Put('roles/:key')
  @RequirePermission('roles.manage')
  update(@Param('key') key: string, @Body() dto: UpdateRoleDto, @Tenant() user: TenantPrincipal) {
    return this.service.update(user, tenantScope(user) as string, key, dto);
  }

  @Delete('roles/:key')
  @HttpCode(200)
  @RequirePermission('roles.manage')
  remove(@Param('key') key: string, @Tenant() user: TenantPrincipal) {
    return this.service.remove(user, tenantScope(user) as string, key);
  }
}
