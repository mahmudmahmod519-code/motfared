import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyMembership } from '../../modules/company-memberships/entities/company-membership.entity';
import { CompanyRef, IdPk, UserRef, UtcNow } from '../columns';

/** Every tap on the claim button and its result (claimed / empty / blocked_* / no_work): evidence for the day's badge. */
@Entity('claim_attempts')
@Index('IDX_claim_attempts_user_date', ['company_id', 'user_id', 'created_at'])
export class ClaimAttempt {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_claim_attempts_company' })
  company: Company;

  @UserRef('user_id')
  user_id: string;

  @ManyToOne(() => CompanyMembership, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_claim_attempts_user' },
    { name: 'user_id', referencedColumnName: 'user_id' },
  ])
  user: CompanyMembership;

  @Column({ length: 30 })
  result: string;

  @Column({ type: 'int', unsigned: true, nullable: true })
  requested: number | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  claimed: number | null;

  @UtcNow('created_at')
  created_at: Date;
}
