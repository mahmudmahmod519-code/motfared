import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { SubscriptionStatus } from '../entities/subscription.entity';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  company_id: string;

  @IsString()
  @IsNotEmpty()
  plan_price_id: string;

  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;

  @IsDateString()
  @IsOptional()
  starts_at?: string;

  @IsDateString()
  @IsOptional()
  current_period_start?: string;

  @IsDateString()
  @IsOptional()
  current_period_end?: string;

  @IsDateString()
  @IsOptional()
  trial_ends_at?: string;

  @IsBoolean()
  @IsOptional()
  cancel_at_period_end?: boolean;
}
