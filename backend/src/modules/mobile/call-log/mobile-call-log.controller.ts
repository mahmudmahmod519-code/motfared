import { Body, Controller, Get, HttpCode, Post, Query, UseFilters } from '@nestjs/common';
import { Allow, IsOptional, ValidateIf, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MobileCallLogService } from './mobile-call-log.service';
import { TenantApi } from '../../../common/decorators/tenant-api.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Tenant } from '../../../common/decorators/current-user.decorator';
import { MobileExceptionFilter } from '../../../common/filters/mobile-exception.filter';
import { tenantScope, TenantPrincipal } from '../../../common/tenant/tenant-scope';

/**
 * One call as the app sends it. Every field is merely allowed (the service validates the values and skips an
 * unusable row with a stated reason), so a malformed entry never fails the whole batch.
 */
export class SyncCallLogEntryDto {
  @Allow() deviceCallId?: unknown;
  @Allow() phoneNumber?: unknown;
  @Allow() direction?: unknown;
  @Allow() durationSeconds?: unknown;
  @Allow() occurredAt?: unknown;
  @Allow() cachedName?: unknown;
  @Allow() phoneAccountId?: unknown;
}

const ENTRY_FIELDS = ['deviceCallId', 'phoneNumber', 'direction', 'durationSeconds', 'occurredAt', 'cachedName', 'phoneAccountId'];
/** Keeps only the known fields of each entry (a newer app build may add one; an older server must not reject the batch) and turns a non-object into an empty row, which the service refuses as malformed. */
const pickEntryFields = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((e) =>
        // an instance of the DTO class, so the nested validation (and its whitelist) applies to it
        Object.assign(new SyncCallLogEntryDto(), e && typeof e === 'object' ? Object.fromEntries(ENTRY_FIELDS.filter((k) => k in (e as object)).map((k) => [k, (e as any)[k]])) : {}),
      )
    : value;

/** `entries` being a list, and its length, are checked by the service (legacy messages); the whitelist refuses any other top-level field. */
export class SyncCallLogDto {
  @IsOptional()
  @Transform(pickEntryFields)
  @ValidateIf((_o, v) => Array.isArray(v))
  @ValidateNested({ each: true })
  @Type(() => SyncCallLogEntryDto)
  entries?: SyncCallLogEntryDto[];
}

/** The rep's phone call log on the legacy paths and shapes. Company-scoped through @TenantApi. */
@Controller('mobile')
@TenantApi()
@RequirePermission('leads.work') // the rep's own work surface; custom roles must be granted it
@UseFilters(MobileExceptionFilter)
export class MobileCallLogController {
  constructor(private readonly service: MobileCallLogService) {}

  @Post('call-log/sync')
  @HttpCode(200)
  sync(@Body() dto: SyncCallLogDto, @Tenant() user: TenantPrincipal) {
    return this.service.sync(tenantScope(user) as string, user.id, dto.entries);
  }

  @Get('call-log/recent')
  recent(@Query('limit') limit: string, @Tenant() user: TenantPrincipal) {
    return this.service.recent(tenantScope(user) as string, user.id, limit);
  }
}
