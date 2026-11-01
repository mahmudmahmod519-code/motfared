import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissionOrPlatform } from '../../common/decorators/require-permission.decorator';
import { UserStatus } from './entities/user.entity';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';

@Controller('users')
@TenantApi()
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Post()
  @RequirePermissionOrPlatform('accounts.manage')
  create(@Body() dto: CreateUserDto, @Tenant() user: TenantPrincipal) {
    return this.service.create(dto, user);
  }

  @Get()
  @RequirePermissionOrPlatform('accounts.view')
  findAll(@Query('company_id') companyId: string, @Tenant() user: TenantPrincipal) {
    return this.service.findAll(listScope(user, companyId));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.findOneFor(id, user);
  }

  // Authorisation (self / CEO of the same company / platform admin) and the field
  // whitelist are enforced in the service; role, company, status and password cannot
  // be changed here by a non-admin.
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Tenant() user: TenantPrincipal) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  @RequirePermissionOrPlatform('accounts.admin')
  changeStatus(@Param('id') id: string, @Body('status') status: UserStatus, @Tenant() user: TenantPrincipal) {
    return this.service.changeStatus(id, status, user);
  }

  @Delete(':id')
  @Roles('platform_admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
