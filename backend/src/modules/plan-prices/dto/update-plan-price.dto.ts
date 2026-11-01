import { PartialType } from '@nestjs/mapped-types';
import { CreatePlanPriceDto } from './create-plan-price.dto';

export class UpdatePlanPriceDto extends PartialType(CreatePlanPriceDto) {}
