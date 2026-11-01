import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsDateString } from 'class-validator';
import { PlanSalesStatus } from '../entities/plan-sales.entity';

export class CreatePlanSalesDto {
  /** Ignored for company users (taken from the verified token); required only for platform admins. */
  @IsOptional()
  @IsString()
  company_id?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  created_by?: string;

  @IsEnum(PlanSalesStatus)
  @IsOptional()
  status?: PlanSalesStatus;

  @IsString()
  @IsOptional()
  info?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  limit_calls?: number;

  @IsInt()
  @IsOptional()
  limit_bonus_calls?: number;

  @IsDateString()
  @IsOptional()
  period_start?: string;

  @IsDateString()
  @IsOptional()
  period_end?: string;
}
