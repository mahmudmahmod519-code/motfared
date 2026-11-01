import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { RolePermission } from './role-permission.entity';

/**
 * A company's own definition of a role. The four system roles need no row (their defaults live in
 * permissions.catalogue.ts); a row with a system key is that company's override of the defaults,
 * and a row with any other key is a custom role. A row fully replaces the defaults for its key.
 * Memberships reference a role by `key` within their company.
 */
@Entity('roles')
@Unique('UQ_roles_company_key', ['company_id', 'key'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ length: 64 })
  key: string;

  @Column({ length: 100 })
  name: string;

  /** True when `key` is one of the four system roles (this row overrides its defaults). */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  is_system: boolean;

  @OneToMany(() => RolePermission, (rp) => rp.role)
  permissions: RolePermission[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
