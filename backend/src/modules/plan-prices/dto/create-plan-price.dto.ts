import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsBoolean } from 'class-validator';
import { PriceInterval } from '../entities/plan-price.entity';

export class CreatePlanPriceDto {
  @IsString()
  @IsNotEmpty()
  plan_id: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsEnum(PriceInterval)
  @IsNotEmpty()
  interval: PriceInterval;

  @IsString()
  @IsOptional()
  stripe_price_id?: string;

  @IsString()
  @IsOptional()
  paymob_plan_id?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
