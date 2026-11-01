import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Doctor } from './doctor.entity';

/** A ready-made message a rep can send for a doctor's leads; rendered with the lead's data by the server. */
@Entity('spec_doctor_messages')
@Index('IDX_doctor_messages_doctor_sort', ['doctor_id', 'sort_order'])
export class DoctorMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Integer id exposed to the Android app (D8). Assigned by the database. */
  @Column({ name: 'mobile_id', type: 'int', generated: 'increment', unique: true, insert: false, update: false })
  mobile_id: number;

  @Index()
  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'doctor_id' })
  doctor_id: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
