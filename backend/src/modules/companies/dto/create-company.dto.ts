import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { CompanyStatus } from '../entities/company.entity';

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
}
