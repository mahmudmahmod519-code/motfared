import { IsString, IsNotEmpty, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateManualPaymentRequestDto {
  @IsString()
  @IsNotEmpty()
  plan_price_id: string;

  /** InstaPay transaction reference. */
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  reference: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  payer_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Link or description of the receipt shared over WhatsApp; for the reviewer only. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  receipt_reference?: string;
}
