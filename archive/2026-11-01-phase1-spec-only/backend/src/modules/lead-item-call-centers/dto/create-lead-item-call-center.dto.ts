import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt } from 'class-validator';
import { AssignmentRole, AssignmentStatus } from '../entities/lead-item-call-center.entity';

export class CreateLeadItemCallCenterDto {
  @IsString()
  @IsNotEmpty()
  lead_item_id: string;

  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsEnum(AssignmentRole)
  @IsOptional()
  assignment_role?: AssignmentRole;

  @IsInt()
  @IsOptional()
  priority_order?: number;

  @IsEnum(AssignmentStatus)
  @IsOptional()
  status?: AssignmentStatus;

  @IsInt()
  @IsOptional()
  target_calls?: number;

  @IsInt()
  @IsOptional()
  bonus_calls_limit?: number;
}
