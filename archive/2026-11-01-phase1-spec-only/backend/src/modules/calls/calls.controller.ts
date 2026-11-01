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
import { CallsService } from './calls.service';
import { CreateCallDto } from './dto/create-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';

/** Call-center agents (membership role sales, no platform role) are limited to their own calls. */
const agentOnly = (user: any): string | undefined =>
  !isPlatformAdmin(user) && !['owner', 'admin'].includes(user.role) ? user.id : undefined;

@Controller('calls')
@TenantApi()
export class CallsController {
  constructor(private readonly service: CallsService) {}

  @Post()
  create(@Body() dto: CreateCallDto, @Tenant() user: TenantPrincipal) {
    dto.company_id = writeCompany(user, dto.company_id);
    dto.call_center_user_id = user.id;
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('company_id') queryCompanyId: string,
    @Query('lead_contact_id') contactId: string,
    @Query('user_id') queryUserId: string,
    @Tenant() user: TenantPrincipal,
  ) {
    const userId = agentOnly(user) ?? queryUserId;
    return this.service.findAll(listScope(user, queryCompanyId), userId, contactId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.findOne(id, tenantScope(user), agentOnly(user));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCallDto, @Tenant() user: TenantPrincipal) {
    return this.service.update(id, dto, tenantScope(user), agentOnly(user));
  }

  @Delete(':id')
  @Roles('platform_admin', 'owner', 'admin')
  remove(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.remove(id, tenantScope(user));
  }
}
