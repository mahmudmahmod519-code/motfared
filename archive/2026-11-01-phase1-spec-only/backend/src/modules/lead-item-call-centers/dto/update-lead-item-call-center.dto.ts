import { PartialType } from '@nestjs/mapped-types';
import { CreateLeadItemCallCenterDto } from './create-lead-item-call-center.dto';

export class UpdateLeadItemCallCenterDto extends PartialType(CreateLeadItemCallCenterDto) {}
