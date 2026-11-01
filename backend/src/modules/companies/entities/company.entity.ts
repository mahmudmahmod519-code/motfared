import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CompanyMembership } from '../../company-memberships/entities/company-membership.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { BillingCustomer } from '../../billing-customers/entities/billing-customer.entity';

export enum CompanyStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'type_company', length: 100, nullable: true })
  type_company: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'client_label', length: 100, nullable: true })
  client_label: string;

  @Column({ name: 'call_center_label', length: 100, nullable: true })
  call_center_label: string;

  @Column({ name: 'crm_manager_label', length: 100, nullable: true })
  crm_manager_label: string;

  @Column({ name: 'owner_user_id', nullable: true })
  owner_user_id: string;

  @Column({ length: 500, nullable: true })
  address: string;

  @Column({ name: 'phone_whatsapp', length: 30, nullable: true })
  phone_whatsapp: string;

  @Column({ name: 'phone_telephone', length: 30, nullable: true })
  phone_telephone: string;

  @Column({
    type: 'enum',
    enum: CompanyStatus,
    default: CompanyStatus.PENDING,
  })
  status: CompanyStatus;

  @Column({ name: 'social_links', type: 'json', nullable: true })
  social_links: Record<string, string>;

  @OneToMany(() => CompanyMembership, (m) => m.company)
  memberships: CompanyMembership[];

  @OneToMany(() => Subscription, (s) => s.company)
  subscriptions: Subscription[];

  @OneToMany(() => BillingCustomer, (b) => b.company)
  billing_customers: BillingCustomer[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
