import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissionOrPlatform } from '../../common/decorators/require-permission.decorator';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';

@Controller('services')
@TenantApi()
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  @Post()
  @RequirePermissionOrPlatform('services.manage')
  create(@Body() dto: CreateServiceDto, @Tenant() user: TenantPrincipal) {
    return this.service.create(writeCompany(user, dto.company_id), dto);
  }

  @Get()
  findAll(@Query('company_id') queryCompanyId: string, @Tenant() user: TenantPrincipal) {
    return this.service.findAll(listScope(user, queryCompanyId));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Tenant() user: TenantPrincipal) {
    return this.service.findOne(id, tenantScope(user));
  }

  @Patch(':id')
  @RequirePermissionOrPlatform('services.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceDto, @Tenant() user: TenantPrincipal) {
    return this.service.update(id, dto, tenantScope(user));
  }

  @Delete(':id')
  @RequirePermissionOrPlatform('services.manage')
  remove(@Param('id', ParseIntPipe) id: number, @Tenant() user: TenantPrincipal) {
    return this.service.remove(id, tenantScope(user));
  }
}
