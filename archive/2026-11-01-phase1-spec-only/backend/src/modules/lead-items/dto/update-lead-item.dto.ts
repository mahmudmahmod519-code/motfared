import { PartialType } from '@nestjs/mapped-types';
import { CreateLeadItemDto } from './create-lead-item.dto';

export class UpdateLeadItemDto extends PartialType(CreateLeadItemDto) {}
