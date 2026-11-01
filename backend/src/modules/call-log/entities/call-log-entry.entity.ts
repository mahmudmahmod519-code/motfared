import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { LeadContact } from '../../lead-contacts/entities/lead-contact.entity';

/** MySQL returns BIGINT as text; the app and the rules work with epoch milliseconds as numbers. */
const bigintAsNumber = { to: (v?: number | null) => v, from: (v?: string | number | null) => (v == null ? v : Number(v)) };

/**
 * A rep's own device call log, synced up so it survives the rep clearing it on the phone. It is the
 * evidence for "a real call happened" and a source of dials for the attempt counts. The device is the
 * source of truth: the server only ever appends or corrects what the phone reports.
 */
@Entity('spec_call_log_entries')
@Index('IDX_call_log_company_user_time', ['company_id', 'user_id', 'occurred_at'])
@Index('IDX_call_log_user_device', ['user_id', 'device_call_id'])
@Index('IDX_call_log_company_number', ['company_id', 'phone_number'])
export class CallLogEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Integer id exposed to the Android app (D8). Assigned by the database. */
  @Column({ name: 'mobile_id', type: 'int', generated: 'increment', unique: true, insert: false, update: false })
  mobile_id: number;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'user_id' })
  user_id: string;

  // A rep who has synced calls cannot be hard-deleted: the log is evidence.
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** The number in call-key form (see callPhoneKey). */
  @Column({ name: 'phone_number', length: 30 })
  phone_number: string;

  @Index()
  @Column({ name: 'lead_contact_id', type: 'varchar', length: 36, nullable: true })
  lead_contact_id: string | null;

  @ManyToOne(() => LeadContact, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lead_contact_id' })
  lead_contact: LeadContact;

  /** outbound | inbound | missed */
  @Column({ length: 10 })
  direction: string;

  @Column({ name: 'duration_seconds', type: 'int', default: 0 })
  duration_seconds: number;

  /** Epoch milliseconds, as the phone reports it. */
  @Column({ name: 'occurred_at', type: 'bigint', transformer: bigintAsNumber })
  occurred_at: number;

  /** The phone's own CallLog._ID, which is what the app's watermark keys on. */
  @Column({ name: 'device_call_id', type: 'bigint', nullable: true, transformer: bigintAsNumber })
  device_call_id: number | null;

  @Column({ name: 'cached_name', type: 'varchar', length: 200, nullable: true })
  cached_name: string | null;

  /** Which SIM/line the call was placed on (Android PHONE_ACCOUNT_ID). */
  @Column({ name: 'phone_account_id', type: 'varchar', length: 100, nullable: true })
  phone_account_id: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
