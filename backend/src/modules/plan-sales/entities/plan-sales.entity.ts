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
import { User } from '../../users/entities/user.entity';
import { LeadItem } from '../../lead-items/entities/lead-item.entity';

export enum PlanSalesStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

@Entity('plan_sales')
export class PlanSales {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'created_by' })
  created_by: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column({
    type: 'enum',
    enum: PlanSalesStatus,
    default: PlanSalesStatus.DRAFT,
  })
  status: PlanSalesStatus;

  @Column({ type: 'text', nullable: true })
  info: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'limit_calls', type: 'int', nullable: true })
  limit_calls: number;

  @Column({ name: 'limit_bonus_calls', type: 'int', nullable: true })
  limit_bonus_calls: number;

  @Column({ name: 'period_start', type: 'timestamp', nullable: true })
  period_start: Date;

  @Column({ name: 'period_end', type: 'timestamp', nullable: true })
  period_end: Date;

  @OneToMany(() => LeadItem, (li) => li.plan_sales)
  lead_items: LeadItem[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
