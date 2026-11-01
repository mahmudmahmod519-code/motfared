import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { Lead } from '../../leads/entities/lead.entity';
import { PlanSales } from '../../plan-sales/entities/plan-sales.entity';
import { LeadItemCallCenter } from '../../lead-item-call-centers/entities/lead-item-call-center.entity';

export enum LeadItemStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

@Entity('lead_items')
@Unique(['lead_id', 'plan_sales_id'])
export class LeadItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lead_id' })
  lead_id: string;

  @ManyToOne(() => Lead, (l) => l.lead_items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({ name: 'plan_sales_id' })
  plan_sales_id: string;

  @ManyToOne(() => PlanSales, (ps) => ps.lead_items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_sales_id' })
  plan_sales: PlanSales;

  @Column({
    type: 'enum',
    enum: LeadItemStatus,
    default: LeadItemStatus.ACTIVE,
  })
  status: LeadItemStatus;

  @OneToMany(() => LeadItemCallCenter, (licc) => licc.lead_item)
  lead_item_call_centers: LeadItemCallCenter[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
