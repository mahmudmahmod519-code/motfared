import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import { INDUSTRIES } from '../industry/industries';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * What a company's owner changes about how the dashboard presents the company. `terms` and `features` are
 * partial: each key sets an override and `null` returns that key to the template (checked in the service).
 */
export class UpdateCompanyProfileDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(255)
  name?: string;

  /** An https address of the logo, or null to remove it. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(1000)
  logo_url?: string | null;

  @IsOptional() @IsIn(INDUSTRIES)
  industry?: string;

  @IsOptional() @IsObject()
  terms?: Record<string, unknown>;

  @IsOptional() @IsObject()
  features?: Record<string, unknown>;
}
