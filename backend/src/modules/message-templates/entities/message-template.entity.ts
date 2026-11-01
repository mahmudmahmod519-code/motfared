import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';

/** A company's own wording for a named message; a company without a row for a key uses the shipped default. */
@Entity('spec_message_templates')
@Unique('UQ_message_templates_company_key', ['company_id', 'key'])
export class MessageTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'key', length: 100 })
  key: string;

  @Column({ length: 255 })
  label: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'updated_by', type: 'varchar', length: 36, nullable: true })
  updated_by: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
