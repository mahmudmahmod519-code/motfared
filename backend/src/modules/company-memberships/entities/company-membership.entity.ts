import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Team } from '../../../domain/core/team.entity';
import { bigintAsNumber } from '../../../domain/columns';
import { Company } from '../../companies/entities/company.entity';
import { User } from '../../users/entities/user.entity';

export enum MembershipStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('company_memberships')
@Unique(['company_id', 'user_id'])
// one company per person in v1 (decision D-07); relaxing it later is dropping this one constraint
export class CompanyMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, (c) => c.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  // one company per person in v1 (decision D-07): relaxing it later means dropping this unique index
  @Column({ name: 'user_id', unique: true })
  user_id: string;

  @ManyToOne(() => User, (u) => u.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 100 })
  role: string;

  /** The legacy group the member belongs to; a team lead is confined to it (rule enforced in the services, FK enforced here). */
  @Column({ name: 'team_id', type: 'bigint', unsigned: true, nullable: true, transformer: bigintAsNumber })
  team_id: number | null;

  @ManyToOne(() => Team, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_memberships_team' },
    { name: 'team_id', referencedColumnName: 'id' },
  ])
  team: Team | null;

  /** The legacy "unrestricted" exemption (claim window, hold limit, call evidence); set only by the owner or a platform admin. */
  @Column({ type: 'boolean', default: false })
  unrestricted: boolean;

  /** Set when the member is deactivated; history keeps pointing at them. */
  @Column({ name: 'deactivated_at', type: 'datetime', precision: 3, nullable: true })
  deactivated_at: Date | null;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.ACTIVE,
  })
  status: MembershipStatus;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
