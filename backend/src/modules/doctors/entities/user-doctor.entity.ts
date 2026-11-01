import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { Doctor } from './doctor.entity';

/** The three slots a rep has, in priority order. */
export enum DoctorRank {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  TERTIARY = 'tertiary',
}

/**
 * Which doctors a rep works. The three-doctor ceiling is a business rule, so the schema itself
 * refuses a fourth: `rank` is a three-value ENUM and (user, rank) is unique. (An enum rather than
 * a CHECK because TypeORM does not manage CHECK constraints on MySQL.)
 */
@Entity('spec_user_doctors')
@Unique('UQ_user_doctors_user_rank', ['user_id', 'rank'])
@Unique('UQ_user_doctors_user_doctor', ['user_id', 'doctor_id'])
export class UserDoctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'doctor_id' })
  doctor_id: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ type: 'enum', enum: DoctorRank })
  rank: DoctorRank;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
