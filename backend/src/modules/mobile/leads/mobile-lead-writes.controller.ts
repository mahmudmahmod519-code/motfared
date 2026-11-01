import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseFilters } from '@nestjs/common';
import { MobileLeadWritesService } from './mobile-lead-writes.service';
import { CreateMobileLeadDto, UpdateMobileLeadDto, WrittenContactDto } from './dto/mobile-lead-write.dto';
import { TenantApi } from '../../../common/decorators/tenant-api.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Tenant } from '../../../common/decorators/current-user.decorator';
import { MobileExceptionFilter } from '../../../common/filters/mobile-exception.filter';
import { tenantScope, TenantPrincipal } from '../../../common/tenant/tenant-scope';

/**
 * Lead writes and messages for the Android app, on the legacy paths and shapes. Company-scoped through
 * @TenantApi (auth, roles, subscription rules); the whitelist on every body means a client can never
 * set a status, owner, company or source.
 */
@Controller('mobile')
@TenantApi()
@RequirePermission('leads.work') // the rep's own work surface; custom roles must be granted it
@UseFilters(MobileExceptionFilter)
export class MobileLeadWritesController {
  constructor(private readonly service: MobileLeadWritesService) {}

  @Post('leads')
  create(@Body() dto: CreateMobileLeadDto, @Tenant() user: TenantPrincipal) {
    return this.service.create(tenantScope(user) as string, user.id, dto);
  }

  @Patch('leads/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMobileLeadDto, @Tenant() user: TenantPrincipal) {
    return this.service.update(tenantScope(user) as string, user.id, id, dto);
  }

  @Delete('leads/:id')
  remove(@Param('id', ParseIntPipe) id: number, @Tenant() user: TenantPrincipal) {
    return this.service.remove(tenantScope(user) as string, user.id, id);
  }

  @Post('leads/:id/reopen')
  @HttpCode(200)
  reopen(@Param('id', ParseIntPipe) id: number, @Tenant() user: TenantPrincipal) {
    return this.service.reopen(tenantScope(user) as string, user.id, id);
  }

  @Post('leads/:id/written-contact')
  @HttpCode(200)
  writtenContact(@Param('id', ParseIntPipe) id: number, @Body() dto: WrittenContactDto, @Tenant() user: TenantPrincipal) {
    return this.service.writtenContact(tenantScope(user) as string, user.id, id, dto);
  }

  @Post('leads/:id/whatsapp-sent')
  @HttpCode(200)
  whatsappSent(@Param('id', ParseIntPipe) id: number, @Tenant() user: TenantPrincipal) {
    return this.service.whatsappSent(tenantScope(user) as string, user.id, id);
  }

  @Get('leads/:id/doctor-messages')
  doctorMessages(@Param('id', ParseIntPipe) id: number, @Tenant() user: TenantPrincipal) {
    return this.service.doctorMessagesFor(tenantScope(user) as string, user.id, id);
  }

  @Get('leads/:id/message/:key')
  message(@Param('id', ParseIntPipe) id: number, @Param('key') key: string, @Tenant() user: TenantPrincipal) {
    return this.service.messageFor(tenantScope(user) as string, user.id, id, key);
  }
}
