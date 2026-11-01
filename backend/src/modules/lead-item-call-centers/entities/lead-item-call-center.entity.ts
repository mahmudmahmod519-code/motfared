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
import { LeadItem } from '../../lead-items/entities/lead-item.entity';
import { User } from '../../users/entities/user.entity';
import { Call } from '../../calls/entities/call.entity';

export enum AssignmentRole {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
}

export enum AssignmentStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

@Entity('lead_item_call_centers')
@Unique(['lead_item_id', 'user_id'])
export class LeadItemCallCenter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lead_item_id' })
  lead_item_id: string;

  @ManyToOne(() => LeadItem, (li) => li.lead_item_call_centers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_item_id' })
  lead_item: LeadItem;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'assignment_role',
    type: 'enum',
    enum: AssignmentRole,
    default: AssignmentRole.PRIMARY,
  })
  assignment_role: AssignmentRole;

  @Column({ name: 'priority_order', type: 'int', nullable: true })
  priority_order: number;

  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.ACTIVE,
  })
  status: AssignmentStatus;

  @Column({ name: 'target_calls', type: 'int', nullable: true })
  target_calls: number;

  @Column({ name: 'bonus_calls_limit', type: 'int', nullable: true })
  bonus_calls_limit: number;

  @OneToMany(() => Call, (c) => c.assignment)
  calls: Call[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
