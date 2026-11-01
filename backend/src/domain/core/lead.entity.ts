import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyMembership } from '../../modules/company-memberships/entities/company-membership.entity';
import { CompanyRef, IdPk, IdRef, UserRef, Utc, UtcNow } from '../columns';
import { Campaign } from './campaign.entity';
import { Service } from './service.entity';
import { Upload } from './upload.entity';

/** The ten statuses of the original product. */
export const LEAD_STATUSES = [
  'new', 'no_answer', 'interested', 'very_interested', 'follow_up', 'booked', 'examined', 'no_show', 'not_interested', 'unreachable',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** How a lead entered the system (the original stored free text; the importer maps it, unknown values become 'unknown'). */
export const LEAD_SOURCES = ['upload', 'sheet', 'public_form', 'manual_admin', 'manual_rep', 'unknown'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/**
 * One person to call. `owner_user_id` NULL means the lead waits in its doctor's pool; a rep owns it from the claim.
 * Phone numbers live here as the rep sees them; `lead_phones` holds their canonical keys and enforces
 * "a number belongs to one lead per company" in the database.
 */
@Entity('leads')
@Unique('UQ_leads_company_id_id', ['company_id', 'id'])
@Index('IDX_leads_owner_status', ['company_id', 'owner_user_id', 'status'])
@Index('IDX_leads_campaign_status_created', ['company_id', 'campaign_id', 'status', 'created_at'])
@Index('IDX_leads_pool', ['company_id', 'campaign_id', 'owner_user_id', 'status', 'first_claimed_at', 'created_at'])
export class Lead {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_leads_company' })
  company: Company;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 50 })
  phone: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  whatsapp_phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alt_name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  alt_phone: string | null;

  @Column({ type: 'enum', enum: LEAD_STATUSES, default: 'new' })
  status: LeadStatus;

  @UserRef('owner_user_id', true)
  owner_user_id: string | null;

  @ManyToOne(() => CompanyMembership, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_leads_owner' },
    { name: 'owner_user_id', referencedColumnName: 'user_id' },
  ])
  owner: CompanyMembership | null;

  @Utc('claimed_at', true)
  claimed_at: Date | null;

  @Utc('first_claimed_at', true)
  first_claimed_at: Date | null;

  @IdRef('campaign_id')
  campaign_id: number;

  @ManyToOne(() => Campaign, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_leads_campaign' },
    { name: 'campaign_id', referencedColumnName: 'id' },
  ])
  campaign: Campaign;

  @IdRef('upload_id', true)
  upload_id: number | null;

  @ManyToOne(() => Upload, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_leads_upload' },
    { name: 'upload_id', referencedColumnName: 'id' },
  ])
  upload: Upload | null;

  @IdRef('service_id', true)
  service_id: number | null;

  @ManyToOne(() => Service, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_leads_service' },
    { name: 'service_id', referencedColumnName: 'id' },
  ])
  service: Service | null;

  @Column({ type: 'enum', enum: LEAD_SOURCES, nullable: true })
  source: LeadSource | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  whatsapp_count: number;

  @Utc('whatsapp_sent_at', true)
  whatsapp_sent_at: Date | null;

  @Utc('client_contact_at', true)
  client_contact_at: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  client_contact_via: string | null;

  @Column({ type: 'text', nullable: true })
  client_contact_note: string | null;

  @UtcNow('created_at')
  created_at: Date;
}
