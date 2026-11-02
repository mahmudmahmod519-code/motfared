import { IsString, IsOptional, IsEnum, IsObject, IsIn } from 'class-validator';
import { CompanyStatus } from '../entities/company.entity';
import { INDUSTRIES } from '../industry/industries';

export class CreateCompanyDto {
  @IsString()
  name: string;

  @IsOptional() @IsString() type_company?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() client_label?: string;
  @IsOptional() @IsString() call_center_label?: string;
  @IsOptional() @IsString() crm_manager_label?: string;
  @IsOptional() @IsString() owner_user_id?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone_whatsapp?: string;
  @IsOptional() @IsString() phone_telephone?: string;
  @IsOptional() @IsEnum(CompanyStatus) status?: CompanyStatus;
  @IsOptional() @IsObject() social_links?: Record<string, string>;
  /** The words/features template (industry/industries.ts); a company's owner changes it through /company-profile. */
  @IsOptional() @IsIn(INDUSTRIES) industry?: string;
}
