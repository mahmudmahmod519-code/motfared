import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyMembership } from '../../modules/company-memberships/entities/company-membership.entity';
import { CompanyRef, IdPk, IdRef, UserRef, UtcNow } from '../columns';
import { Campaign } from './campaign.entity';

/** One uploaded sheet: how many rows were valid, duplicates and invalid. */
@Entity('uploads')
@Unique('UQ_uploads_company_id_id', ['company_id', 'id'])
export class Upload {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_uploads_company' })
  company: Company;

  @IdRef('campaign_id')
  campaign_id: number;

  @ManyToOne(() => Campaign, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_uploads_campaign' },
    { name: 'campaign_id', referencedColumnName: 'id' },
  ])
  campaign: Campaign;

  @UserRef('uploaded_by', true)
  uploaded_by: string | null;

  @ManyToOne(() => CompanyMembership, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_uploads_uploader' },
    { name: 'uploaded_by', referencedColumnName: 'user_id' },
  ])
  uploader: CompanyMembership | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  filename: string | null;

  @Column({ type: 'int', unsigned: true })
  total_rows: number;

  @Column({ type: 'int', unsigned: true })
  valid_count: number;

  @Column({ type: 'int', unsigned: true })
  duplicate_count: number;

  @Column({ type: 'int', unsigned: true })
  invalid_count: number;

  @UtcNow('created_at')
  created_at: Date;
}
