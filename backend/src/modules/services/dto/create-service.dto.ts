import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** A service is a name on the company's shared list of treatments, and whether it is offered. */
export class CreateServiceDto {
  /** Ignored for company users (taken from the verified token); required only for platform admins. */
  @IsOptional()
  @IsString()
  company_id?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
