import { LeadContact } from '../../lead-contacts/entities/lead-contact.entity';
import { sqlStamp } from '../../../common/clock/cairo-clock';

/** Statuses with nothing left for the rep to do: a lead in one of these leaves the working list after a week. */
export const TERMINAL_LEAD_STATUSES = ['not_interested', 'unreachable', 'examined', 'no_show'];
/** How long a finished lead stays on the rep's working list before moving to history. */
export const LEAD_LIST_RECENT_DAYS = 7;
export const HISTORY_PAGE_SIZE_MAX = 200;
export const LEAD_GONE_MESSAGE = 'الليد ده مبقاش في قايمتك';

/** A MySQL Date as the legacy backend wrote it ('YYYY-MM-DD HH:MM:SS', UTC): what the app's parser expects. */
export const stamp = (d: Date | null | undefined): string | null => (d ? sqlStamp(d) : null);

/**
 * One lead in the shape the legacy backend sent (REP_LEAD_SELECT), which the Android parsers read.
 * `id` is the integer `mobile_id` (D8). Booking-derived fields are null until the bookings package
 * exists. Tenant internals (company_id, uuids) never go on the wire.
 */
export function toWireLead(c: LeadContact, outcomeCount: number) {
  return {
    id: c.mobile_id,
    name: c.name,
    phone: c.phone,
    whatsappPhone: c.whatsapp_phone ?? null,
    status: c.work_status,
    created_at: stamp(c.created_at),
    claimed_at: stamp(c.claimed_at),
    whatsapp_sent_at: stamp(c.whatsapp_sent_at),
    whatsappCount: c.whatsapp_count ?? 0,
    notes: c.notes ?? null,
    altName: c.alt_name ?? null,
    altPhone: c.alt_phone ?? null,
    clientContactAt: stamp(c.client_contact_at),
    clientContactVia: c.client_contact_via ?? null,
    source: c.source ?? null,
    doctorId: c.lead?.doctor?.mobile_id ?? null,
    doctorName: c.lead?.doctor?.name ?? null,
    serviceName: c.service?.name ?? null,
    caseName: null as string | null, // from bookings (package B6)
    callCount: outcomeCount,
    activeBookingId: null as number | null, // from bookings (package B6)
    activeBookingAt: null as string | null,
  };
}

/**
 * Yesterday's silent numbers first: on the second day the leads that did not answer the day before
 * come to the top, ahead of the batch that arrived this morning. "Silent and still owed a call today"
 * is the test. Stable: inside each band the list keeps its newest-first order.
 */
export function orderForCalling<T extends { status: string; attemptsToday: number; nextAction: { action: string } | null }>(leads: T[]): T[] {
  const owedFirst = (l: T) => (l.status === 'no_answer' && l.attemptsToday === 0 && l.nextAction?.action === 'call' ? 0 : 1);
  return leads
    .map((lead, index) => ({ lead, index }))
    .sort((a, b) => owedFirst(a.lead) - owedFirst(b.lead) || a.index - b.index)
    .map((e) => e.lead);
}

/** A phone-call-log row as the activity timeline shows it (the call log itself is ported in package B9). */
export const CALL_DIRECTION_LABELS: Record<string, string> = { outbound: 'صادرة', inbound: 'واردة', missed: 'فايتة' };

export function toWirePhoneCall(row: { id?: string | number; phoneNumber?: string; direction: string; durationSeconds: number; occurredAt: number; repName?: string | null; leadId?: unknown }) {
  return {
    id: row.id,
    phoneNumber: row.phoneNumber,
    direction: row.direction,
    directionLabel: CALL_DIRECTION_LABELS[row.direction] || row.direction,
    durationSeconds: row.durationSeconds,
    occurredAt: row.occurredAt, // epoch milliseconds, as the app reads it with optLong
    repName: row.repName ?? null,
    matched: row.leadId != null,
  };
}
