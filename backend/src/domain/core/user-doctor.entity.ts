import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyMembership } from '../../modules/company-memberships/entities/company-membership.entity';
import { CompanyRef, IdPk, IdRef, UserRef } from '../columns';
import { Doctor } from './doctor.entity';

export const DOCTOR_RANKS = ['primary', 'secondary', 'tertiary'] as const;
export type DoctorRank = (typeof DOCTOR_RANKS)[number];

/**
 * A rep's link to a doctor. Replaces the three columns on the original users table while keeping the structural
 * ceiling: one row per rank, so a fourth doctor, or the same doctor twice, cannot exist.
 */
@Entity('user_doctors')
@Unique('UQ_user_doctors_user_rank', ['company_id', 'user_id', 'rank'])
@Unique('UQ_user_doctors_user_doctor', ['company_id', 'user_id', 'doctor_id'])
export class UserDoctor {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_user_doctors_company' })
  company: Company;

  @UserRef('user_id')
  user_id: string;

  @ManyToOne(() => CompanyMembership, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_user_doctors_member' },
    { name: 'user_id', referencedColumnName: 'user_id' },
  ])
  member: CompanyMembership;

  @IdRef('doctor_id')
  doctor_id: number;

  @ManyToOne(() => Doctor, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_user_doctors_doctor' },
    { name: 'doctor_id', referencedColumnName: 'id' },
  ])
  doctor: Doctor;

  @Column({ type: 'enum', enum: DOCTOR_RANKS })
  rank: DoctorRank;
}
