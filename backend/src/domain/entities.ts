import { Team } from './core/team.entity';
import { Doctor } from './core/doctor.entity';
import { Campaign } from './core/campaign.entity';
import { Service } from './core/service.entity';
import { Upload } from './core/upload.entity';
import { Lead } from './core/lead.entity';
import { LeadPhone } from './core/lead-phone.entity';
import { UserDoctor } from './core/user-doctor.entity';
import { Booking } from './history/booking.entity';
import { CallResult } from './history/call-result.entity';
import { CallLogEntry } from './history/call-log-entry.entity';
import { Reminder } from './history/reminder.entity';
import { BookingEvent } from './history/booking-event.entity';
import { LeadHandover } from './history/lead-handover.entity';
import { ClaimAttempt } from './history/claim-attempt.entity';

/**
 * The rebuilt tenant domain (docs/rebuild/06). Registered next to the port-era entities, which live on
 * under `spec_*` table names until the modules that use them are rebuilt.
 */
export const DOMAIN_ENTITIES = [
  Team, Doctor, Campaign, Service, Upload, Lead, LeadPhone, UserDoctor,
  Booking, CallResult, CallLogEntry, Reminder, BookingEvent, LeadHandover, ClaimAttempt,
];
