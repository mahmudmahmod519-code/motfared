import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ApproveManualPaymentRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectManualPaymentRequestDto {
  @IsString()
  @MaxLength(500)
  note: string;
}
