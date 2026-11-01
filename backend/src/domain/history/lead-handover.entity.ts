import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyMembership } from '../../modules/company-memberships/entities/company-membership.entity';
import { CompanyRef, IdPk, IdRef, UserRef, UtcNow } from '../columns';
import { Lead } from '../core/lead.entity';

/** Every hand-over of a lead (claimed from the pool, returned, redistributed…) with the attempts behind it. */
@Entity('lead_handovers')
@Index('IDX_lead_handovers_lead', ['company_id', 'lead_id', 'created_at'])
export class LeadHandover {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_lead_handovers_company' })
  company: Company;

  @IdRef('lead_id')
  lead_id: number;

  @ManyToOne(() => Lead, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_lead_handovers_lead' },
    { name: 'lead_id', referencedColumnName: 'id' },
  ])
  lead: Lead;

  /** NULL when the lead came out of the pool. */
  @UserRef('from_user_id', true)
  from_user_id: string | null;

  @ManyToOne(() => CompanyMembership, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_lead_handovers_from' },
    { name: 'from_user_id', referencedColumnName: 'user_id' },
  ])
  from: CompanyMembership | null;

  /** NULL when the lead went back to the pool. */
  @UserRef('to_user_id', true)
  to_user_id: string | null;

  @ManyToOne(() => CompanyMembership, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_lead_handovers_to' },
    { name: 'to_user_id', referencedColumnName: 'user_id' },
  ])
  to: CompanyMembership | null;

  @Column({ length: 40 })
  reason: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  attempts: number;

  @UtcNow('created_at')
  created_at: Date;
}
