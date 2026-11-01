import { IsString, IsEnum, IsOptional } from 'class-validator';
import { MembershipStatus } from '../entities/company-membership.entity';

export class CreateCompanyMembershipDto {
  @IsString() company_id: string;
  @IsString() user_id: string;
  @IsString() role: string;
  @IsOptional() @IsEnum(MembershipStatus) status?: MembershipStatus;
}
