import { IsEmail, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from '../../../common/auth/password-policy';

/** Sign in with a phone number or an email (at least one); both must then name the same account. */
export class LoginDto {
  @ValidateIf((o) => o.phone === undefined || o.email !== undefined)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => o.email === undefined || o.phone !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
