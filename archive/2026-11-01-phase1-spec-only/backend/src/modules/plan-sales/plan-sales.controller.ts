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
import { PlanSalesService } from './plan-sales.service';
import { CreatePlanSalesDto } from './dto/create-plan-sales.dto';
import { UpdatePlanSalesDto } from './dto/update-plan-sales.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';

@Controller('plan-sales')
@TenantApi()
export class PlanSalesController {
  constructor(private readonly service: PlanSalesService) {}

  @Post()
  @Roles('platform_admin', 'owner', 'admin')
  create(@Body() dto: CreatePlanSalesDto, @Tenant() user: TenantPrincipal) {
    dto.company_id = writeCompany(user, dto.company_id);
    dto.created_by = user.id;
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
  update(@Param('id') id: string, @Body() dto: UpdatePlanSalesDto, @Tenant() user: TenantPrincipal) {
    return this.service.update(id, dto, tenantScope(user));
  }

  @Delete(':id')
  @Roles('platform_admin', 'owner', 'admin')
  remove(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.remove(id, tenantScope(user));
  }
}
