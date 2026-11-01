import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';

/**
 * A doctor is the agency's client (a clinic), not a user. Leads are worked on a doctor's behalf;
 * reps are linked to up to three of them (see UserDoctor).
 */
@Entity('spec_doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Integer id exposed to the Android app (D8). Assigned by the application; always used together with company scoping. */
  @Column({ name: 'mobile_id', type: 'int', unique: true, nullable: true })
  mobile_id: number | null;

  @Index()
  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ length: 255 })
  name: string;

  /** Legacy group id, kept so migrated data retains its team structure (D11). No rules attached yet. */
  @Column({ name: 'team_id', type: 'int', nullable: true })
  team_id: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
