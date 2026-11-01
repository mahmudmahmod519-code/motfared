import { PartialType } from '@nestjs/mapped-types';
import { CreatePlanSalesDto } from './create-plan-sales.dto';

export class UpdatePlanSalesDto extends PartialType(CreatePlanSalesDto) {}
