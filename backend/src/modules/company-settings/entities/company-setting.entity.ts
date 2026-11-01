import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';

/** Per-company key/value settings (legacy `settings`), e.g. `weekly_off_days`. A key is unique within a company only. */
@Entity('spec_company_settings')
@Unique('UQ_company_settings_company_key', ['company_id', 'key'])
export class CompanySetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'key', length: 100 })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
