import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ROLE_KEY_PATTERN } from '../permissions.catalogue';

export class CreateRoleDto {
  @IsString()
  @Matches(ROLE_KEY_PATTERN, { message: 'key must be lower-case letters, digits and underscores, starting with a letter (2-40 characters)' })
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permissions: string[];
}

export class UpdateRoleDto {
  /** Custom roles only; the name of a system role is fixed. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  /** The complete list: it replaces what the role had. */
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permissions: string[];
}
