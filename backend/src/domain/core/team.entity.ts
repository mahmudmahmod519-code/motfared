import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyRef, IdPk, UtcNow } from '../columns';

/** A legacy group (1/2/3 shown A/B/C) made explicit: doctors and reps belong to a team; a team lead is pinned to theirs. */
@Entity('teams')
@Unique('UQ_teams_company_id_id', ['company_id', 'id'])
@Unique('UQ_teams_company_code', ['company_id', 'code'])
export class Team {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_teams_company' })
  company: Company;

  @Column({ length: 100 })
  name: string;

  /** A / B / C in the original. */
  @Column({ length: 20 })
  code: string;

  @UtcNow('created_at')
  created_at: Date;
}
