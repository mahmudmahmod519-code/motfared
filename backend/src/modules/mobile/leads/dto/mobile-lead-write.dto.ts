import { IsInt, IsOptional, IsString } from 'class-validator';

/**
 * Bodies the Android app sends. Every string is validated by the service with the legacy messages
 * (an empty or unreadable value is the service's 400, not a generic validation error), so these only
 * pin the field NAMES and types: anything else (status, owner, company, source…) is refused by the
 * whitelist, which is what stops a client from setting what only the server may set.
 */
export class CreateMobileLeadDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() whatsappPhone?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsInt() doctorId?: number;
}

export class UpdateMobileLeadDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() altName?: string;
  @IsOptional() @IsString() altPhone?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() whatsappPhone?: string;
}

export class WrittenContactDto {
  @IsOptional() @IsString() contactedVia?: string;
  @IsOptional() @IsString() contactNote?: string;
}
