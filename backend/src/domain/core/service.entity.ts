import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyRef, IdPk, UtcNow } from '../columns';

/** A treatment/service of the company's shared list. Deactivated, never deleted (leads and bookings point at it). */
@Entity('services')
@Unique('UQ_services_company_id_id', ['company_id', 'id'])
@Unique('UQ_services_company_name', ['company_id', 'name'])
export class Service {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_services_company' })
  company: Company;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @UtcNow('created_at')
  created_at: Date;
}
