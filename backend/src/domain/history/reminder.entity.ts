import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyMembership } from '../../modules/company-memberships/entities/company-membership.entity';
import { CompanyRef, IdPk, IdRef, UserRef, Utc, UtcNow } from '../columns';
import { Lead } from '../core/lead.entity';

/** A rep's promise to call a lead back at a time: one per rep per lead (the original enforced it only in code). */
@Entity('reminders')
@Unique('UQ_reminders_lead_user', ['company_id', 'lead_id', 'user_id'])
@Index('IDX_reminders_user_time', ['company_id', 'user_id', 'remind_at'])
export class Reminder {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_reminders_company' })
  company: Company;

  @IdRef('lead_id')
  lead_id: number;

  @ManyToOne(() => Lead, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_reminders_lead' },
    { name: 'lead_id', referencedColumnName: 'id' },
  ])
  lead: Lead;

  @UserRef('user_id')
  user_id: string;

  @ManyToOne(() => CompanyMembership, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_reminders_user' },
    { name: 'user_id', referencedColumnName: 'user_id' },
  ])
  user: CompanyMembership;

  @Utc('remind_at')
  remind_at: Date;

  @UtcNow('created_at')
  created_at: Date;

  @Column({ type: 'varchar', length: 300, nullable: true })
  reason: string | null;
}
