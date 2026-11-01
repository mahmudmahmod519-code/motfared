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
import { LeadItemsService } from './lead-items.service';
import { CreateLeadItemDto } from './dto/create-lead-item.dto';
import { UpdateLeadItemDto } from './dto/update-lead-item.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';

@Controller('lead-items')
@TenantApi()
export class LeadItemsController {
  constructor(private readonly service: LeadItemsService) {}

  // Platform admins have no home company: the plan's company is resolved from the plan itself.
  @Post()
  @Roles('platform_admin', 'owner', 'admin')
  async create(@Body() dto: CreateLeadItemDto, @Tenant() user: TenantPrincipal) {
    const scope = tenantScope(user);
    if (scope) return this.service.create(dto, scope);
    return this.service.createAsAdmin(dto);
  }

  @Get()
  findAll(@Query('plan_sales_id') planSalesId: string, @Tenant() user: TenantPrincipal) {
    return this.service.findAll(planSalesId, tenantScope(user));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.findOne(id, tenantScope(user));
  }

  @Patch(':id')
  @Roles('platform_admin', 'owner', 'admin')
  update(@Param('id') id: string, @Body() dto: UpdateLeadItemDto, @Tenant() user: TenantPrincipal) {
    return this.service.update(id, dto, tenantScope(user));
  }

  @Delete(':id')
  @Roles('platform_admin', 'owner', 'admin')
  remove(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.remove(id, tenantScope(user));
  }
}
