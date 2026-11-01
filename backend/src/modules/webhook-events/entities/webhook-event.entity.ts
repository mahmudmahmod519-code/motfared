import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('webhook_events')
@Unique(['provider', 'provider_event_id'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  provider: string;

  @Column({ name: 'provider_event_id', length: 255 })
  provider_event_id: string;

  @Column({ name: 'event_type', length: 255 })
  event_type: string;

  @Column({ type: 'json', nullable: true })
  payload: Record<string, any>;

  @Column({ default: false })
  processed: boolean;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processed_at: Date;

  @Column({ name: 'processing_error', type: 'text', nullable: true })
  processing_error: string;

  @Column({ name: 'received_at', type: 'timestamp' })
  received_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
