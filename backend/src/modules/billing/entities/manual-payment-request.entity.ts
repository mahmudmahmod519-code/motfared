import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { PlanPrice } from '../../plan-prices/entities/plan-price.entity';

export enum ManualPaymentStatus {
  PENDING_VERIFICATION = 'pending_verification',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * A company's claim that it paid by InstaPay/WhatsApp. It is only a claim: nothing is
 * activated until a platform admin approves it, and a receipt reference is stored for the
 * reviewer, never treated as proof.
 */
@Entity('manual_payment_requests')
@Index(['company_id', 'status'])
export class ManualPaymentRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'plan_price_id' })
  plan_price_id: string;

  @ManyToOne(() => PlanPrice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_price_id' })
  plan_price: PlanPrice;

  @Column({ name: 'requested_by' })
  requested_by: string;

  /** The reference exactly as the company typed it. */
  @Column({ length: 100 })
  reference: string;

  /** Normalised (trimmed, lower-case): one InstaPay reference can be claimed only once, by anyone. */
  @Column({ name: 'reference_key', length: 100, unique: true })
  reference_key: string;

  @Column({ name: 'payer_phone', length: 30, nullable: true })
  payer_phone: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string;

  @Column({ name: 'receipt_reference', type: 'varchar', length: 500, nullable: true })
  receipt_reference: string;

  /** Copied from the plan price on the server; never accepted from the client. */
  @Column({ name: 'expected_amount', type: 'decimal', precision: 12, scale: 2 })
  expected_amount: number;

  @Column({ length: 10 })
  currency: string;

  @Column({ type: 'enum', enum: ManualPaymentStatus, default: ManualPaymentStatus.PENDING_VERIFICATION })
  status: ManualPaymentStatus;

  @Column({ name: 'reviewed_by', type: 'varchar', length: 36, nullable: true })
  reviewed_by: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewed_at: Date | null;

  @Column({ name: 'review_note', type: 'varchar', length: 500, nullable: true })
  review_note: string | null;

  @Column({ name: 'subscription_id', type: 'varchar', length: 36, nullable: true })
  subscription_id: string | null;

  @Column({ name: 'payment_id', type: 'varchar', length: 36, nullable: true })
  payment_id: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
