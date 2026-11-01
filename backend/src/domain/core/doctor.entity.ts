import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyRef, IdPk, IdRef, UtcNow } from '../columns';
import { Team } from './team.entity';

/** The agency's client (a clinic). Not a user. `slug` is a public URL (/dr/:slug), so it is unique across all companies. */
@Entity('doctors')
@Unique('UQ_doctors_company_id_id', ['company_id', 'id'])
@Index('UQ_doctors_slug', ['slug'], { unique: true })
export class Doctor {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_doctors_company' })
  company: Company;

  @IdRef('team_id', true)
  team_id: number | null;

  @ManyToOne(() => Team, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn(
    [
      { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_doctors_team' },
      { name: 'team_id', referencedColumnName: 'id' },
    ],
  )
  team: Team | null;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  whatsapp: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  maps_url: string | null;

  @Column({ type: 'text', nullable: true })
  hours: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  facebook_url: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  instagram_url: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  slug: string | null;

  @UtcNow('created_at')
  created_at: Date;
}
