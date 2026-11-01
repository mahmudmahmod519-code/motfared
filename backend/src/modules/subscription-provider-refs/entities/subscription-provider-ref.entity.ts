import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Entity('subscription_provider_refs')
@Unique(['provider', 'provider_subscription_id'])
export class SubscriptionProviderRef {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subscription_id' })
  subscription_id: string;

  @ManyToOne(() => Subscription, (s) => s.provider_refs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription;

  @Column({ length: 100 })
  provider: string;

  @Column({ name: 'provider_subscription_id', length: 255, nullable: true })
  provider_subscription_id: string;

  @Column({ name: 'provider_price_id', length: 255, nullable: true })
  provider_price_id: string;

  @Column({ name: 'provider_plan_id', length: 255, nullable: true })
  provider_plan_id: string;

  /** Provider timestamp of the newest event applied to this subscription; older events cannot change its status. */
  @Column({ name: 'last_event_at', type: 'timestamp', nullable: true })
  last_event_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
