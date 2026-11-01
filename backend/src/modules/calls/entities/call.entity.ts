import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { LeadContact } from '../../lead-contacts/entities/lead-contact.entity';
import { LeadItemCallCenter } from '../../lead-item-call-centers/entities/lead-item-call-center.entity';
import { User } from '../../users/entities/user.entity';

export enum CallOutcome {
  ANSWERED = 'answered',
  NO_ANSWER = 'no_answer',
  BUSY = 'busy',
  REJECTED = 'rejected',
  CALLBACK_REQUESTED = 'callback_requested',
  WRONG_NUMBER = 'wrong_number',
  VOICEMAIL = 'voicemail',
}

export enum CustomerDecision {
  INTERESTED = 'interested',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  NEEDS_FOLLOW_UP = 'needs_follow_up',
  UNDECIDED = 'undecided',
}

@Entity('calls')
export class Call {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'lead_contact_id' })
  lead_contact_id: string;

  @ManyToOne(() => LeadContact, (lc) => lc.calls, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_contact_id' })
  lead_contact: LeadContact;

  @Column({ name: 'assignment_id', nullable: true })
  assignment_id: string;

  @ManyToOne(() => LeadItemCallCenter, (licc) => licc.calls, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: LeadItemCallCenter;

  @Column({ name: 'call_center_user_id' })
  call_center_user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'call_center_user_id' })
  call_center_user: User;

  @Column({ type: 'enum', enum: CallOutcome })
  outcome: CallOutcome;

  @Column({
    name: 'customer_decision',
    type: 'enum',
    enum: CustomerDecision,
    nullable: true,
  })
  customer_decision: CustomerDecision;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  duration_seconds: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'called_at', type: 'timestamp' })
  called_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
