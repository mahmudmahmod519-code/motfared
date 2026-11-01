import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { LeadItem } from '../../lead-items/entities/lead-item.entity';
import { LeadContact } from '../../lead-contacts/entities/lead-contact.entity';
import { Doctor } from '../../doctors/entities/doctor.entity';

@Entity('spec_leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ length: 255 })
  name: string;

  /** The doctor this campaign/source works for (legacy campaign.doctor_id). */
  @Column({ name: 'doctor_id', type: 'varchar', length: 36, nullable: true })
  doctor_id: string | null;

  @ManyToOne(() => Doctor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'source_type', length: 100 })
  source_type: string;

  @Column({ name: 'google_sheet_id', length: 255, nullable: true })
  google_sheet_id: string;

  @Column({ name: 'google_sheet_tab', length: 255, nullable: true })
  google_sheet_tab: string;

  @Column({ name: 'source_reference_url', length: 500, nullable: true })
  source_reference_url: string;

  @Column({ name: 'source_config', type: 'json', nullable: true })
  source_config: Record<string, any>;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => LeadItem, (li) => li.lead)
  lead_items: LeadItem[];

  @OneToMany(() => LeadContact, (lc) => lc.lead)
  lead_contacts: LeadContact[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
