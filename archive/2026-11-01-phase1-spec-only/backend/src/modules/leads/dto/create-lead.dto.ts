import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateLeadDto {
  /** Ignored for company users (taken from the verified token); required only for platform admins. */
  @IsOptional()
  @IsString()
  company_id?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  source_type: string;

  @IsString()
  @IsOptional()
  google_sheet_id?: string;

  @IsString()
  @IsOptional()
  google_sheet_tab?: string;

  @IsString()
  @IsOptional()
  source_reference_url?: string;

  @IsObject()
  @IsOptional()
  source_config?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
