import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTeamDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;

  /** A / B / C in the original. */
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(20)
  code: string;
}

export class UpdateTeamDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100)
  name?: string;

  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(20)
  code?: string;
}

/** The original's clinic fields. `null` clears an optional one. */
export class CreateDoctorDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;

  @IsOptional() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER)
  team_id?: number | null;

  @IsOptional() @IsString() @MaxLength(100) city?: string | null;
  @IsOptional() @IsString() @MaxLength(50) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(50) whatsapp?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) address?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) maps_url?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) hours?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) facebook_url?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) instagram_url?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;

  /** The readable part of the public address /dr/<slug>; validated with the original's rules. */
  @IsOptional() @IsString() @MaxLength(100) slug?: string | null;

  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateDoctorDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(255)
  name?: string;

  @IsOptional() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER)
  team_id?: number | null;

  @IsOptional() @IsString() @MaxLength(100) city?: string | null;
  @IsOptional() @IsString() @MaxLength(50) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(50) whatsapp?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) address?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) maps_url?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) hours?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) facebook_url?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) instagram_url?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
  @IsOptional() @IsString() @MaxLength(100) slug?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CampaignNameDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;
}
