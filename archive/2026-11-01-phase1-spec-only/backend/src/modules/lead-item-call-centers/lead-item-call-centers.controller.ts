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
import { LeadItemCallCentersService } from './lead-item-call-centers.service';
import { CreateLeadItemCallCenterDto } from './dto/create-lead-item-call-center.dto';
import { UpdateLeadItemCallCenterDto } from './dto/update-lead-item-call-center.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';

@Controller('lead-item-call-centers')
@TenantApi()
export class LeadItemCallCentersController {
  constructor(private readonly service: LeadItemCallCentersService) {}

  @Post()
  @Roles('platform_admin', 'owner', 'admin')
  async create(@Body() dto: CreateLeadItemCallCenterDto, @Tenant() user: TenantPrincipal) {
    const scope = tenantScope(user);
    if (scope) return this.service.create(dto, scope);
    return this.service.createAsAdmin(dto);
  }

  @Get()
  findAll(
    @Query('lead_item_id') leadItemId: string,
    @Query('user_id') queryUserId: string,
    @Tenant() user: TenantPrincipal,
  ) {
    // Call-center agents only ever see their own assignments.
    const userId = isPlatformAdmin(user) || ['owner', 'admin'].includes(user.role) ? queryUserId : user.id;
    return this.service.findAll(leadItemId, userId, tenantScope(user));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.findOne(id, tenantScope(user));
  }

  @Patch(':id')
  @Roles('platform_admin', 'owner', 'admin')
  update(@Param('id') id: string, @Body() dto: UpdateLeadItemCallCenterDto, @Tenant() user: TenantPrincipal) {
    return this.service.update(id, dto, tenantScope(user));
  }

  @Delete(':id')
  @Roles('platform_admin', 'owner', 'admin')
  remove(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.remove(id, tenantScope(user));
  }
}
