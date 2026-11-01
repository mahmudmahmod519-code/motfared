import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { CallLogEntry } from '../../call-log/entities/call-log-entry.entity';
import { LeadContact } from '../../lead-contacts/entities/lead-contact.entity';
import { callPhoneKey, callPhoneTail, phoneMatchSets } from '../../../common/phone/call-phone';

export const CALL_DIRECTIONS = ['outbound', 'inbound', 'missed'];
export const MAX_CALL_DURATION_SECONDS = 6 * 60 * 60;
export const MAX_CALL_LOG_SYNC_ENTRIES = 200;
/**
 * How far off the server clock a synced entry may be. The call log is self-reported, and a forged entry dated
 * far ahead used to satisfy "a recent connected call" for ever. An hour tolerates the drift of the cheap
 * handsets the reps carry (a phone ten minutes fast had every call refused when this was five minutes) while
 * staying nowhere near the years-ahead forgery the limit exists to stop. Older than two weeks cannot back
 * anything up and is only ever a device with a wrong clock.
 */
export const CALL_LOG_MAX_FUTURE_MS = 60 * 60 * 1000;
export const CALL_LOG_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const isInt = (v: unknown) => Number.isFinite(Number(v));
const cleanText = (value: unknown, max: number): string | null => {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? (s.length > max ? s.slice(0, max) : s) : null;
};

/**
 * The rep's synced phone call log. Everything is scoped by the verified company: a call is only ever linked
 * to a lead of the caller's own company, and `recent` lists only the caller's own calls.
 */
@Injectable()
export class MobileCallLogService {
  constructor(
    @InjectRepository(CallLogEntry) private readonly calls: Repository<CallLogEntry>,
    @InjectRepository(LeadContact) private readonly contacts: Repository<LeadContact>,
  ) {}

  /**
   * The lead a call on this rep's work line was about, or null. A call on the work line is the lead's whoever
   * holds the lead now, so it is searched in the order of whose it most likely was: a lead with the number that
   * this rep holds; one this rep worked before; any lead with the number (the one someone holds first, then the
   * newest). The same call must always land on the same lead, hence the full ordering.
   */
  async findLead(companyId: string, userId: string, phoneKey: string): Promise<LeadContact | null> {
    const tail = callPhoneTail(phoneKey);
    const qb = this.contacts
      .createQueryBuilder('c')
      .where('c.company_id = :companyId', { companyId })
      .andWhere(
        `(c.phone_key IN (:key, :plusKey) OR c.whatsapp_phone IN (:key, :plusKey) OR c.alt_phone IN (:key, :plusKey)
          OR (:tail IS NOT NULL AND (RIGHT(c.phone_key, 10) = :tail OR RIGHT(c.whatsapp_phone, 10) = :tail OR RIGHT(c.alt_phone, 10) = :tail)))`,
        { key: phoneKey, plusKey: `+${phoneKey}`, tail },
      )
      .addSelect('(c.assigned_user_id = :userId)', 'rank_held')
      .addSelect('(EXISTS (SELECT 1 FROM spec_call_results cr WHERE cr.lead_contact_id = c.id AND cr.user_id = :userId))', 'rank_worked')
      .addSelect('(c.assigned_user_id IS NOT NULL)', 'rank_owned')
      .setParameter('userId', userId)
      .orderBy('rank_held', 'DESC')
      .addOrderBy('rank_worked', 'DESC')
      .addOrderBy('rank_owned', 'DESC')
      .addOrderBy('c.mobile_id', 'DESC')
      .limit(1);
    return qb.getOne();
  }

  /**
   * The stored row this uploaded entry already is. Keyed on the device's own CallLog._ID when sent; without one
   * the (rep, number, start time) key still finds it, but one *row* per matching entry: two genuinely different
   * calls stamped in the same second stay two rows, and a resync of the same window is still idempotent because
   * `consumed` makes the second entry match the second row.
   */
  private async findStored(companyId: string, userId: string, number: string, occurredAt: number, direction: string, deviceCallId: number | null, consumed: Set<string>) {
    if (deviceCallId != null) {
      const byDevice = await this.calls.findOne({ where: { company_id: companyId, user_id: userId, device_call_id: deviceCallId } });
      if (byDevice) return byDevice;
    }
    // A row already carrying a different device id is a different call; an entry that names its id only adopts
    // a row that has none. A build sending no id at all matches whatever is there.
    const rows = await this.calls.find({ where: { company_id: companyId, user_id: userId, phone_number: number, occurred_at: occurredAt as any }, order: { mobile_id: 'ASC' } });
    const free = rows.filter((r) => !consumed.has(r.id) && (deviceCallId == null || r.device_call_id == null || r.device_call_id === deviceCallId));
    return free.find((r) => r.direction === direction) || free[0] || null;
  }

  async sync(companyId: string, userId: string, entries: unknown) {
    if (!Array.isArray(entries)) throw new BadRequestException('entries لازم تكون مصفوفة');
    if (entries.length > MAX_CALL_LOG_SYNC_ENTRIES) throw new BadRequestException(`أقصى عدد في المرة الواحدة ${MAX_CALL_LOG_SYNC_ENTRIES}`);

    const now = Date.now();
    let synced = 0;
    let updated = 0;
    let skipped = 0;
    // Why each refused entry was refused, so "the server threw your calls away" can be diagnosed, not only counted.
    const skippedDetail: { reason: string; occurredAt: number | null }[] = [];
    const consumed = new Set<string>();
    const refuse = (reason: string, row: any) => {
      skipped++;
      if (skippedDetail.length < MAX_CALL_LOG_SYNC_ENTRIES) skippedDetail.push({ reason, occurredAt: Number(row?.occurredAt) || null });
    };

    for (const row of entries) {
      // One malformed entry is one skipped row, never a rolled-back batch (the app would resend a poisoned batch for ever).
      try {
        const phoneNumber = callPhoneKey(row?.phoneNumber);
        const direction = CALL_DIRECTIONS.includes(row?.direction) ? row.direction : null;
        const occurredAt = Number(row?.occurredAt);
        if (!phoneNumber || !direction || !Number.isFinite(occurredAt)) { refuse('malformed', row); continue; }
        if (occurredAt > now + CALL_LOG_MAX_FUTURE_MS) { refuse('future', row); continue; }
        if (occurredAt < now - CALL_LOG_MAX_AGE_MS) { refuse('too_old', row); continue; }

        const duration = isInt(row.durationSeconds) && row.durationSeconds !== null && Number(row.durationSeconds) >= 0
          ? Math.min(Math.floor(Number(row.durationSeconds)), MAX_CALL_DURATION_SECONDS)
          : 0;
        const cachedName = cleanText(row.cachedName, 200);
        const phoneAccountId = cleanText(row.phoneAccountId, 100);
        const deviceCallId = isInt(row.deviceCallId) && Number(row.deviceCallId) > 0 ? Math.floor(Number(row.deviceCallId)) : null;

        const lead = await this.findLead(companyId, userId, phoneNumber);
        const stored = await this.findStored(companyId, userId, phoneNumber, occurredAt, direction, deviceCallId, consumed);
        if (stored) {
          consumed.add(stored.id);
          // Last write wins: the device is the source of truth and its later report is its better one. A lead link
          // already made is never dropped by a resync that happens to run while the lead is unassigned.
          const changed =
            stored.direction !== direction || stored.duration_seconds !== duration ||
            (!stored.lead_contact_id && !!lead) || (stored.device_call_id == null && deviceCallId != null);
          if (changed) {
            await this.calls.update(stored.id, {
              direction,
              duration_seconds: duration,
              cached_name: cachedName ?? stored.cached_name,
              phone_account_id: phoneAccountId ?? stored.phone_account_id,
              lead_contact_id: stored.lead_contact_id ?? lead?.id ?? null,
              device_call_id: stored.device_call_id ?? deviceCallId,
            });
            updated++;
          }
          continue;
        }
        const saved = await this.calls.save(
          this.calls.create({
            company_id: companyId, user_id: userId, phone_number: phoneNumber, lead_contact_id: lead?.id ?? null, direction,
            duration_seconds: duration, occurred_at: occurredAt, cached_name: cachedName, phone_account_id: phoneAccountId, device_call_id: deviceCallId,
          }),
        );
        consumed.add(saved.id);
        synced++;
      } catch {
        refuse('rejected', row);
      }
    }
    return { ok: true, synced, updated, skipped, skippedDetail };
  }

  /** The rep's own persisted call log, newest first, joined to the lead's current name. */
  async recent(companyId: string, userId: string, limitParam: unknown) {
    const limit = Math.min(Math.max(Number(limitParam) || 30, 1), 100);
    const rows = await this.calls
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.lead_contact', 'lead')
      .where('e.company_id = :companyId AND e.user_id = :userId', { companyId, userId })
      .orderBy('e.occurred_at', 'DESC')
      .addOrderBy('e.mobile_id', 'DESC')
      .limit(limit)
      .getMany();
    return {
      entries: rows.map((e) => ({
        id: e.mobile_id,
        phoneNumber: e.phone_number,
        direction: e.direction,
        durationSeconds: e.duration_seconds,
        occurredAt: e.occurred_at,
        cachedName: e.cached_name,
        phoneAccountId: e.phone_account_id,
        leadId: e.lead_contact?.mobile_id ?? null,
        leadName: e.lead_contact?.name ?? null,
      })),
    };
  }

  /**
   * Re-runs the number match over this company's calls that landed on no lead, for one lead. A call is matched
   * once, when the phone first reports it, yet every number a lead has can be learned afterwards (a second number
   * saved, a client typed in after the call). Called wherever a lead's numbers appear or change; idempotent.
   */
  async attachCallsToLead(companyId: string, contactId: string): Promise<number> {
    const lead = await this.contacts.findOne({ where: { id: contactId, company_id: companyId } });
    if (!lead) return 0;
    const { keys, tails } = phoneMatchSets([lead.phone, lead.whatsapp_phone, lead.alt_phone]);
    if (!keys.length && !tails.length) return 0;
    const qb = this.calls.createQueryBuilder().update(CallLogEntry).set({ lead_contact_id: lead.id }).where('company_id = :companyId AND lead_contact_id IS NULL', { companyId });
    const clauses: string[] = [];
    if (keys.length) clauses.push('phone_number IN (:...keys)');
    if (tails.length) clauses.push('RIGHT(phone_number, 10) IN (:...tails)');
    qb.andWhere(`(${clauses.join(' OR ')})`, { keys, tails });
    return (await qb.execute()).affected ?? 0;
  }

  /** Outbound dials of each lead (epoch ms), in one query: they raise the attempt counts the cadence reads. */
  async dialsByLead(companyId: string, contactIds: string[]): Promise<Map<string, number[]>> {
    const map = new Map<string, number[]>();
    if (!contactIds.length) return map;
    const rows = await this.calls.find({ where: { company_id: companyId, lead_contact_id: In(contactIds), direction: 'outbound' }, select: { lead_contact_id: true, occurred_at: true } });
    for (const r of rows) map.set(r.lead_contact_id!, [...(map.get(r.lead_contact_id!) ?? []), r.occurred_at]);
    return map;
  }

  /** Calls on a lead's story: linked to it, or not linked yet but to one of its numbers (up to 100, newest first). */
  async phoneCallsFor(companyId: string, lead: LeadContact) {
    const { keys, tails } = phoneMatchSets([lead.phone, lead.whatsapp_phone, lead.alt_phone]);
    const qb = this.calls
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'u')
      .where('e.company_id = :companyId', { companyId });
    const unlinked: string[] = [];
    if (keys.length) unlinked.push('e.phone_number IN (:...keys)');
    if (tails.length) unlinked.push('RIGHT(e.phone_number, 10) IN (:...tails)');
    qb.andWhere(unlinked.length ? `(e.lead_contact_id = :leadId OR (e.lead_contact_id IS NULL AND (${unlinked.join(' OR ')})))` : 'e.lead_contact_id = :leadId', { leadId: lead.id, keys, tails });
    return qb.orderBy('e.occurred_at', 'DESC').addOrderBy('e.mobile_id', 'DESC').limit(100).getMany();
  }
}

export { IsNull };
