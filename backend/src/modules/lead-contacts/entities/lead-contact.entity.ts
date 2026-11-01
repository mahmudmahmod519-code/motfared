import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { toCanonicalPhone } from '../../../common/phone/phone';
import { Service } from '../../services/entities/service.entity';
import { User } from '../../users/entities/user.entity';
import { Company } from '../../companies/entities/company.entity';
import { Lead } from '../../leads/entities/lead.entity';
import { Call } from '../../calls/entities/call.entity';

export enum LeadContactStatus {
  NEW = 'new',
  QUEUED = 'queued',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  CONVERTED = 'converted',
  REJECTED = 'rejected',
  DO_NOT_CONTACT = 'do_not_contact',
  ARCHIVED = 'archived',
}

@Entity('lead_contacts')
// One lead per canonical phone within a company (D12). Rows whose phone is not recognisable have no key and are not constrained.
@Unique('UQ_lead_contacts_company_phone_key', ['company_id', 'phone_key'])
export class LeadContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'lead_id' })
  lead_id: string;

  @ManyToOne(() => Lead, (l) => l.lead_contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({ name: 'external_row_id', length: 255, nullable: true })
  external_row_id: string;

  @Column({ name: 'source_reference', length: 500, nullable: true })
  source_reference: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 30 })
  phone: string;

  @Column({ length: 30, nullable: true })
  telephone: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ type: 'int', nullable: true })
  age: number;

  @Column({
    type: 'enum',
    enum: LeadContactStatus,
    default: LeadContactStatus.NEW,
  })
  status: LeadContactStatus;


  /** Integer id exposed to the Android app (D8). Assigned by the database; always used together with company scoping. */
  @Column({ name: 'mobile_id', type: 'int', generated: 'increment', unique: true, insert: false, update: false })
  mobile_id: number;

  /** Canonical form of `phone` (see toCanonicalPhone); the per-company duplicate key. */
  @Column({ name: 'phone_key', type: 'varchar', length: 20, nullable: true })
  phone_key: string | null;

  // ---- mobile work state (ported from the legacy `leads` table) ----
  /** Legacy lifecycle status (new, no_answer, interested, booked, …); separate from the CRM `status` above. */
  @Column({ name: 'work_status', length: 30, default: 'new' })
  work_status: string;

  @Column({ name: 'whatsapp_phone', type: 'varchar', length: 30, nullable: true })
  whatsapp_phone: string | null;

  @Column({ name: 'alt_name', type: 'varchar', length: 255, nullable: true })
  alt_name: string | null;

  @Column({ name: 'alt_phone', type: 'varchar', length: 30, nullable: true })
  alt_phone: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** 'rep' for a lead the rep added themselves; anything else came from an import. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  source: string | null;

  @Column({ name: 'service_id', type: 'varchar', length: 36, nullable: true })
  service_id: string | null;

  @ManyToOne(() => Service, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ name: 'whatsapp_count', type: 'int', default: 0 })
  whatsapp_count: number;

  @Column({ name: 'whatsapp_sent_at', type: 'timestamp', nullable: true })
  whatsapp_sent_at: Date | null;

  @Column({ name: 'client_contact_at', type: 'timestamp', nullable: true })
  client_contact_at: Date | null;

  @Column({ name: 'client_contact_via', type: 'varchar', length: 30, nullable: true })
  client_contact_via: string | null;

  @Column({ name: 'client_contact_note', type: 'varchar', length: 500, nullable: true })
  client_contact_note: string | null;

  /** The rep who holds the lead (claim/pool, package B4). */
  @Column({ name: 'assigned_user_id', type: 'varchar', length: 36, nullable: true })
  assigned_user_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_user_id' })
  assigned_user: User;

  @Column({ name: 'claimed_at', type: 'timestamp', nullable: true })
  claimed_at: Date | null;

  @Column({ name: 'first_claimed_at', type: 'timestamp', nullable: true })
  first_claimed_at: Date | null;

  /** Legacy group id, kept so migrated data retains its team structure (D11). No rules attached yet. */
  @Column({ name: 'team_id', type: 'int', nullable: true })
  team_id: number | null;

  @BeforeInsert()
  @BeforeUpdate()
  syncPhoneKey() {
    // Only when the phone is part of this save; repo.update() callers set phone_key themselves.
    if (this.phone !== undefined) this.phone_key = this.phone ? toCanonicalPhone(this.phone) : null;
  }

  @OneToMany(() => Call, (c) => c.lead_contact)
  calls: Call[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
