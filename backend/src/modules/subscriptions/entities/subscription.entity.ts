import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { PlanPrice } from '../../plan-prices/entities/plan-price.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { SubscriptionProviderRef } from '../../subscription-provider-refs/entities/subscription-provider-ref.entity';

export enum SubscriptionStatus {
  INCOMPLETE = 'incomplete',
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
  UNPAID = 'unpaid',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, (c) => c.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'plan_price_id' })
  plan_price_id: string;

  @ManyToOne(() => PlanPrice, (pp) => pp.subscriptions)
  @JoinColumn({ name: 'plan_price_id' })
  plan_price: PlanPrice;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.INCOMPLETE })
  status: SubscriptionStatus;

  @Column({ name: 'starts_at', type: 'timestamp' })
  starts_at: Date;

  @Column({ name: 'current_period_start', type: 'timestamp', nullable: true })
  current_period_start: Date;

  @Column({ name: 'current_period_end', type: 'timestamp', nullable: true })
  current_period_end: Date;

  @Column({ name: 'trial_ends_at', type: 'timestamp', nullable: true })
  trial_ends_at: Date;

  @Column({ name: 'cancel_at_period_end', default: false })
  cancel_at_period_end: boolean;

  @Column({ name: 'canceled_at', type: 'timestamp', nullable: true })
  canceled_at: Date;

  @OneToMany(() => Payment, (p) => p.subscription)
  payments: Payment[];

  @OneToMany(() => SubscriptionProviderRef, (spr) => spr.subscription)
  provider_refs: SubscriptionProviderRef[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
