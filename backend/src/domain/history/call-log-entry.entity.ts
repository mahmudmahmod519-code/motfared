import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyMembership } from '../../modules/company-memberships/entities/company-membership.entity';
import { bigintAsNumber, CompanyRef, IdPk, IdRef, UserRef, UtcNow } from '../columns';
import { Lead } from '../core/lead.entity';

/**
 * A rep's synced device call log. `occurred_at` is the phone's epoch in milliseconds, kept as sent. A call links to
 * a lead of its own company or to none; unlinking is how a lead with calls is deleted (history is never cascaded).
 */
@Entity('call_log_entries')
@Unique('UQ_call_log_device', ['company_id', 'user_id', 'device_call_id'])
@Index('IDX_call_log_lookup', ['company_id', 'user_id', 'phone_number', 'occurred_at'])
@Index('IDX_call_log_user_time', ['company_id', 'user_id', 'occurred_at'])
export class CallLogEntry {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_call_log_company' })
  company: Company;

  @UserRef('user_id')
  user_id: string;

  @ManyToOne(() => CompanyMembership, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_call_log_user' },
    { name: 'user_id', referencedColumnName: 'user_id' },
  ])
  user: CompanyMembership;

  @Column({ length: 30 })
  phone_number: string;

  @IdRef('lead_id', true)
  lead_id: number | null;

  @ManyToOne(() => Lead, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_call_log_lead' },
    { name: 'lead_id', referencedColumnName: 'id' },
  ])
  lead: Lead | null;

  @Column({ length: 10 })
  direction: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  duration_seconds: number;

  @Column({ type: 'bigint', unsigned: true, transformer: bigintAsNumber })
  occurred_at: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true, transformer: bigintAsNumber })
  device_call_id: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  cached_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  phone_account_id: string | null;

  @UtcNow('created_at')
  created_at: Date;
}
