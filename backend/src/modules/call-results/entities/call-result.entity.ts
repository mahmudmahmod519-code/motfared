import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { LeadContact } from '../../lead-contacts/entities/lead-contact.entity';
import { User } from '../../users/entities/user.entity';

/**
 * The rep's outcome for a lead (legacy `call_results`): the single source from which attempts,
 * the follow-up cadence and every "calls made" figure are derived. Never summarised in a stored counter.
 * `kind` is 'lead' for an outcome after a real call and 'manual' for one set by hand.
 */
@Entity('spec_call_results')
@Index('IDX_call_results_company_user_created', ['company_id', 'user_id', 'created_at'])
export class CallResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Index()
  @Column({ name: 'lead_contact_id' })
  lead_contact_id: string;

  // Results go with their lead, as the legacy backend deleted them with it.
  @ManyToOne(() => LeadContact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_contact_id' })
  lead_contact: LeadContact;

  @Column({ name: 'user_id' })
  user_id: string;

  // A rep who has logged results cannot be hard-deleted: the history is kept.
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 30 })
  outcome: string;

  @Column({ length: 20, default: 'lead' })
  kind: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
