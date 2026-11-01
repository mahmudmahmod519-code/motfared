import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyRef, IdPk, IdRef } from '../columns';
import { Lead } from './lead.entity';

export const LEAD_PHONE_KINDS = ['phone', 'whatsapp', 'alt'] as const;

/**
 * The canonical key of each number a lead carries. UNIQUE (company_id, phone_key) is the database's own
 * guarantee of the legacy rule "a number belongs to one lead", across all three number columns and race-free.
 * The lead service keeps these rows in step with `leads.phone / whatsapp_phone / alt_phone`.
 */
@Entity('lead_phones')
@Unique('UQ_lead_phones_company_key', ['company_id', 'phone_key'])
@Unique('UQ_lead_phones_lead_kind', ['lead_id', 'kind'])
export class LeadPhone {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_lead_phones_company' })
  company: Company;

  @IdRef('lead_id')
  lead_id: number;

  @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_lead_phones_lead' },
    { name: 'lead_id', referencedColumnName: 'id' },
  ])
  lead: Lead;

  @Column({ type: 'enum', enum: LEAD_PHONE_KINDS })
  kind: (typeof LEAD_PHONE_KINDS)[number];

  @Column({ length: 20 })
  phone_key: string;
}
