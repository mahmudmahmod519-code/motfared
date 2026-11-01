import { IsString, IsEmail, IsOptional, IsEnum, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../../common/auth/password-policy';
import { ROLE_KEY_PATTERN } from '../../rbac/permissions.catalogue';
import { UserStatus } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;

  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() company_id?: string;
  @IsOptional() @IsString() platform_role?: string;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsString() whatsapp_phone?: string;
  /** Membership role granted in the user's company (ignored without a company). */
  @IsOptional() @IsString() @Matches(ROLE_KEY_PATTERN) role?: string;
}
