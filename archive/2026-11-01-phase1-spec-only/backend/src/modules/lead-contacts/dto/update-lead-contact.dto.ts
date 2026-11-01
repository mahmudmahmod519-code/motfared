import { PartialType } from '@nestjs/mapped-types';
import { CreateLeadContactDto } from './create-lead-contact.dto';

export class UpdateLeadContactDto extends PartialType(CreateLeadContactDto) {}
