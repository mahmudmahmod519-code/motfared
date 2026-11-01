import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyMembership } from '../../modules/company-memberships/entities/company-membership.entity';
import { CompanyRef, IdPk, IdRef, UserRef, UtcNow } from '../columns';
import { Lead } from '../core/lead.entity';
import { CALL_RESULT_KINDS } from '../vocabulary';
import { Booking } from './booking.entity';

/**
 * Every outcome a rep recorded on a lead: the single source for attempts, cadence and "calls made" (never stored
 * counters). `kind` separates real calls ('lead') from manual closes and reminder calls.
 */
@Entity('call_results')
@Index('IDX_call_results_user', ['company_id', 'user_id', 'created_at'])
@Index('IDX_call_results_lead', ['company_id', 'lead_id', 'created_at'])
export class CallResult {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_call_results_company' })
  company: Company;

  @IdRef('lead_id')
  lead_id: number;

  @ManyToOne(() => Lead, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_call_results_lead' },
    { name: 'lead_id', referencedColumnName: 'id' },
  ])
  lead: Lead;

  @UserRef('user_id')
  user_id: string;

  @ManyToOne(() => CompanyMembership, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_call_results_user' },
    { name: 'user_id', referencedColumnName: 'user_id' },
  ])
  user: CompanyMembership;

  @Column({ length: 30 })
  outcome: string;

  @UtcNow('created_at')
  created_at: Date;

  @Column({ type: 'enum', enum: CALL_RESULT_KINDS, default: 'lead' })
  kind: (typeof CALL_RESULT_KINDS)[number];

  @Column({ type: 'varchar', length: 10, nullable: true })
  direction: string | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  duration_seconds: number | null;

  @IdRef('booking_id', true)
  booking_id: number | null;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_call_results_booking' },
    { name: 'booking_id', referencedColumnName: 'id' },
  ])
  booking: Booking | null;
}
