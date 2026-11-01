import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
} from 'class-validator';
import { CallOutcome, CustomerDecision } from '../entities/call.entity';

export class CreateCallDto {
  /** Ignored for company users (taken from the verified token); required only for platform admins. */
  @IsOptional()
  @IsString()
  company_id?: string;

  @IsString()
  @IsNotEmpty()
  lead_contact_id: string;

  @IsString()
  @IsOptional()
  assignment_id?: string;

  @IsString()
  @IsOptional()
  call_center_user_id?: string;

  @IsEnum(CallOutcome)
  @IsNotEmpty()
  outcome: CallOutcome;

  @IsEnum(CustomerDecision)
  @IsOptional()
  customer_decision?: CustomerDecision;

  @IsInt()
  @IsOptional()
  duration_seconds?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  called_at?: string;
}
