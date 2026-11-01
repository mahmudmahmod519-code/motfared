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
import { Company } from '../../companies/entities/company.entity';

@Entity('billing_customers')
@Unique(['provider', 'provider_customer_id'])
@Unique(['company_id', 'provider'])
export class BillingCustomer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, (c) => c.billing_customers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ length: 100 })
  provider: string;

  @Column({ name: 'provider_customer_id', length: 255 })
  provider_customer_id: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
