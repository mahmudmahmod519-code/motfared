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
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';

@Controller('leads')
@TenantApi()
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Post()
  @Roles('platform_admin', 'owner', 'admin')
  create(@Body() dto: CreateLeadDto, @Tenant() user: TenantPrincipal) {
    dto.company_id = writeCompany(user, dto.company_id);
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('company_id') queryCompanyId: string, @Tenant() user: TenantPrincipal) {
    return this.service.findAll(listScope(user, queryCompanyId));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.findOne(id, tenantScope(user));
  }

  @Patch(':id')
  @Roles('platform_admin', 'owner', 'admin')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto, @Tenant() user: TenantPrincipal) {
    return this.service.update(id, dto, tenantScope(user));
  }

  @Delete(':id')
  @Roles('platform_admin', 'owner', 'admin')
  remove(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.remove(id, tenantScope(user));
  }
}
