import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyRef, IdPk, IdRef, UtcNow } from '../columns';
import { Doctor } from './doctor.entity';

/** An ad campaign of one doctor; the unit sheets are uploaded into. */
@Entity('campaigns')
@Unique('UQ_campaigns_company_id_id', ['company_id', 'id'])
export class Campaign {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_campaigns_company' })
  company: Company;

  @IdRef('doctor_id')
  doctor_id: number;

  @ManyToOne(() => Doctor, { onDelete: 'RESTRICT' })
  @JoinColumn(
    [
      { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_campaigns_doctor' },
      { name: 'doctor_id', referencedColumnName: 'id' },
    ],
  )
  doctor: Doctor;

  @Column({ length: 255 })
  name: string;

  @UtcNow('created_at')
  created_at: Date;
}
