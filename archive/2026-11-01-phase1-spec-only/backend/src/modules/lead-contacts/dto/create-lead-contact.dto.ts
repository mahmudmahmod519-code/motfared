import { IsString, IsNotEmpty, IsOptional, IsEmail, IsInt, IsEnum } from 'class-validator';
import { LeadContactStatus } from '../entities/lead-contact.entity';

export class CreateLeadContactDto {
  /** Ignored for company users (taken from the verified token); required only for platform admins. */
  @IsOptional()
  @IsString()
  company_id?: string;

  @IsString()
  @IsNotEmpty()
  lead_id: string;

  @IsString()
  @IsOptional()
  external_row_id?: string;

  @IsString()
  @IsOptional()
  source_reference?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  telephone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsInt()
  @IsOptional()
  age?: number;

  @IsEnum(LeadContactStatus)
  @IsOptional()
  status?: LeadContactStatus;
}
