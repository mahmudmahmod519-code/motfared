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
import { Plan } from '../../plans/entities/plan.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

export enum PriceInterval {
  MONTH = 'month',
  YEAR = 'year',
}

@Entity('plan_prices')
export class PlanPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id' })
  plan_id: string;

  @ManyToOne(() => Plan, (p) => p.plan_prices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ length: 10 })
  currency: string;

  @Column({ type: 'enum', enum: PriceInterval })
  interval: PriceInterval;

  @Column({ name: 'stripe_price_id', length: 255, nullable: true })
  stripe_price_id: string;

  @Column({ name: 'paymob_plan_id', length: 255, nullable: true })
  paymob_plan_id: string;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @OneToMany(() => Subscription, (s) => s.plan_price)
  subscriptions: Subscription[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
