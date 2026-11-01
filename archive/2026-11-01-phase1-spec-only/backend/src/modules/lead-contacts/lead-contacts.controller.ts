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
import { LeadContactsService } from './lead-contacts.service';
import { CreateLeadContactDto } from './dto/create-lead-contact.dto';
import { UpdateLeadContactDto } from './dto/update-lead-contact.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { LeadContactStatus } from './entities/lead-contact.entity';
import { tenantScope, listScope, writeCompany, isPlatformAdmin, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';

@Controller('lead-contacts')
@TenantApi()
export class LeadContactsController {
  constructor(private readonly service: LeadContactsService) {}

  @Post()
  @Roles('platform_admin', 'owner', 'admin')
  create(@Body() dto: CreateLeadContactDto, @Tenant() user: TenantPrincipal) {
    dto.company_id = writeCompany(user, dto.company_id);
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('company_id') queryCompanyId: string,
    @Query('lead_id') leadId: string,
    @Query('status') status: LeadContactStatus,
    @Tenant() user: TenantPrincipal,
  ) {
    return this.service.findAll(listScope(user, queryCompanyId), leadId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.findOne(id, tenantScope(user));
  }

  // Call-center agents work contacts (status updates) but go through the same tenant check.
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadContactDto, @Tenant() user: TenantPrincipal) {
    return this.service.update(id, dto, tenantScope(user));
  }

  @Delete(':id')
  @Roles('platform_admin', 'owner', 'admin')
  remove(@Param('id') id: string, @Tenant() user: TenantPrincipal) {
    return this.service.remove(id, tenantScope(user));
  }
}
