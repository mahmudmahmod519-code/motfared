import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { CompanyMembership } from '../../modules/company-memberships/entities/company-membership.entity';
import { CompanyRef, IdPk, IdRef, UserRef, UtcNow } from '../columns';
import { Booking } from './booking.entity';

/** The audit trail of a booking (booked, rescheduled, reminder message sent, cancelled…). */
@Entity('booking_events')
@Index('IDX_booking_events_booking', ['company_id', 'booking_id', 'id'])
export class BookingEvent {
  @IdPk()
  id: number;

  @CompanyRef()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_booking_events_company' })
  company: Company;

  @IdRef('booking_id')
  booking_id: number;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_booking_events_booking' },
    { name: 'booking_id', referencedColumnName: 'id' },
  ])
  booking: Booking;

  @Column({ length: 40 })
  kind: string;

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @UserRef('by_user_id', true)
  by_user_id: string | null;

  @ManyToOne(() => CompanyMembership, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'company_id', foreignKeyConstraintName: 'FK_booking_events_by' },
    { name: 'by_user_id', referencedColumnName: 'user_id' },
  ])
  by: CompanyMembership | null;

  @UtcNow('at')
  at: Date;
}
