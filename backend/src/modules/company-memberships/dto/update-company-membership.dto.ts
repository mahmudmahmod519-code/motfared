import { PartialType } from '@nestjs/mapped-types';
import { CreateCompanyMembershipDto } from './create-company-membership.dto';
export class UpdateCompanyMembershipDto extends PartialType(CreateCompanyMembershipDto) {}
