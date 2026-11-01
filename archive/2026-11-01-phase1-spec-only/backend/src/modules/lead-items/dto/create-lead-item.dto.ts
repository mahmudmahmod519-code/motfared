import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { LeadItemStatus } from '../entities/lead-item.entity';

export class CreateLeadItemDto {
  @IsString()
  @IsNotEmpty()
  lead_id: string;

  @IsString()
  @IsNotEmpty()
  plan_sales_id: string;

  @IsEnum(LeadItemStatus)
  @IsOptional()
  status?: LeadItemStatus;
}
