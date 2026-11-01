/**
 * Phase 2.3 — what the DATABASE guarantees for the work history: call results, the phone's call log,
 * reminders (promises), bookings and their trail, hand-overs and claim attempts. Tried directly in MySQL
 * with the schema built from the real migrations. Written before the migration.
 */
import { bootstrap } from './harness';
import { Team } from '../../src/domain/core/team.entity';
import { Doctor } from '../../src/domain/core/doctor.entity';
import { Campaign } from '../../src/domain/core/campaign.entity';
import { Service } from '../../src/domain/core/service.entity';
import { Lead } from '../../src/domain/core/lead.entity';
import { CallResult } from '../../src/domain/history/call-result.entity';
import { CallLogEntry } from '../../src/domain/history/call-log-entry.entity';
import { Reminder } from '../../src/domain/history/reminder.entity';
import { Booking } from '../../src/domain/history/booking.entity';
import { BookingEvent } from '../../src/domain/history/booking-event.entity';
import { LeadHandover } from '../../src/domain/history/lead-handover.entity';
import { ClaimAttempt } from '../../src/domain/history/claim-attempt.entity';
import { CompanyMembership } from '../../src/modules/company-memberships/entities/company-membership.entity';

const code = (e: any) => e?.code ?? e?.driverError?.code;
const fails = async (p: Promise<unknown>, expected: string) => {
  let err: any;
  try { await p; } catch (e) { err = e; }
  expect({ failed: !!err, code: code(err) }).toEqual({ failed: true, code: expected });
};
const NO_PARENT = 'ER_NO_REFERENCED_ROW_2';
const HAS_CHILD = 'ER_ROW_IS_REFERENCED_2';
const DUP = 'ER_DUP_ENTRY';
const BAD_VALUE = 'WARN_DATA_TRUNCATED';

describe('Rebuilt tenant domain: history tables', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const A: Record<string, any> = {};
  const B: Record<string, any> = {};
  let phoneSeq = 0;
  const NOW = () => new Date();

  const mkLead = async (co: Record<string, any>) =>
    (await h.db.getRepository(Lead).insert({ company_id: co.id, name: 'L', phone: `01${String(++phoneSeq).padStart(9, '0')}`, campaign_id: co.campaign } as any)).identifiers[0].id as number;

  const booking = (co: Record<string, any>, leadId: number, extra: Record<string, any> = {}) =>
    h.db.getRepository(Booking).insert({
      company_id: co.id, lead_id: leadId, booked_by_user_id: co.rep, reminder_owner_user_id: co.rep2,
      contacted_at: NOW(), scheduled_for: new Date(Date.now() + 864e5), ...extra,
    } as any);

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    for (const [co, tag] of [[A, 'A'], [B, 'B']] as const) {
      co.id = (await h.mkCompany(`History ${tag}`)).id;
      co.rep = (await h.mkUser(`Rep ${tag}`, `rep-${tag}@h.test`, co.id, 'sales')).id;
      co.rep2 = (await h.mkUser(`Rep2 ${tag}`, `rep2-${tag}@h.test`, co.id, 'sales')).id;
      const team = (await h.db.getRepository(Team).insert({ company_id: co.id, name: tag, code: tag } as any)).identifiers[0].id;
      co.doctor = (await h.db.getRepository(Doctor).insert({ company_id: co.id, name: `Dr ${tag}`, team_id: team } as any)).identifiers[0].id;
      co.campaign = (await h.db.getRepository(Campaign).insert({ company_id: co.id, doctor_id: co.doctor, name: `C ${tag}` } as any)).identifiers[0].id;
      co.service = (await h.db.getRepository(Service).insert({ company_id: co.id, name: `S ${tag}` } as any)).identifiers[0].id;
      co.lead = await mkLead(co);
    }
  });
  afterAll(async () => { await h.app?.close(); });

  describe('call_results', () => {
    const result = (co: Record<string, any>, extra: Record<string, any> = {}) =>
      h.db.getRepository(CallResult).insert({ company_id: co.id, lead_id: co.lead, user_id: co.rep, outcome: 'no_answer', ...extra } as any);

    it('records an outcome with the original defaults (kind lead, timestamp now)', async () => {
      const id = (await result(A)).identifiers[0].id;
      const row = await h.db.getRepository(CallResult).findOneByOrFail({ id });
      expect(row).toMatchObject({ kind: 'lead', outcome: 'no_answer', direction: null, duration_seconds: null, booking_id: null });
      expect(typeof row.id).toBe('number');
      expect(Math.abs(row.created_at.getTime() - Date.now())).toBeLessThan(60_000);
    });
    it('accepts the three kinds and any outcome text, rejects an unknown kind', async () => {
      for (const kind of ['lead', 'manual', 'reminder']) await expect(result(A, { kind })).resolves.toBeDefined();
      await expect(result(A, { outcome: 'reminder_rescheduled', kind: 'reminder', direction: 'outbound', duration_seconds: 42 })).resolves.toBeDefined();
      await fails(result(A, { kind: 'guess' }), BAD_VALUE);
    });
    it("cannot name another company's lead or user, or a booking of another company", async () => {
      await fails(result(A, { lead_id: B.lead }), NO_PARENT);
      await fails(result(A, { user_id: B.rep }), NO_PARENT);
      const bb = (await booking(B, await mkLead(B))).identifiers[0].id;
      await fails(result(A, { booking_id: bb }), NO_PARENT);
    });
    it('a lead that has results cannot be deleted (history is kept)', async () => {
      const lead = await mkLead(A);
      await result(A, { lead_id: lead });
      await fails(h.db.getRepository(Lead).delete({ id: lead }), HAS_CHILD);
    });
    it("a member who has recorded results cannot be removed", async () => {
      await fails(h.db.getRepository(CompanyMembership).delete({ user_id: A.rep }), HAS_CHILD);
    });
  });

  describe('call_log_entries (the phone\'s own log)', () => {
    const entry = (co: Record<string, any>, extra: Record<string, any> = {}) =>
      h.db.getRepository(CallLogEntry).insert({ company_id: co.id, user_id: co.rep, phone_number: '01012345678', direction: 'outbound', occurred_at: Date.now(), ...extra } as any);

    it('stores a millisecond epoch exactly and hands it back as a number', async () => {
      const ms = 1793476366123;
      const id = (await entry(A, { occurred_at: ms })).identifiers[0].id;
      const row = await h.db.getRepository(CallLogEntry).findOneByOrFail({ id });
      expect(row.occurred_at).toBe(ms);
      expect(typeof row.occurred_at).toBe('number');
      expect(row.duration_seconds).toBe(0);
      expect(row.lead_id).toBeNull();
    });
    it('a call may link to a lead of its own company only', async () => {
      await expect(entry(A, { lead_id: A.lead })).resolves.toBeDefined();
      await fails(entry(A, { lead_id: B.lead }), NO_PARENT);
    });
    it('belongs to a member of the company', async () => {
      await fails(entry(A, { user_id: B.rep }), NO_PARENT);
    });
    it('the same device call cannot be stored twice for a rep, but calls without a device id are not constrained', async () => {
      await entry(A, { device_call_id: 7001 });
      await fails(entry(A, { device_call_id: 7001 }), DUP);
      await expect(entry(A, { user_id: A.rep2, device_call_id: 7001 })).resolves.toBeDefined(); // another rep's phone
      await expect(entry(A, { device_call_id: null })).resolves.toBeDefined();
      await expect(entry(A, { device_call_id: null })).resolves.toBeDefined();
    });
    it('a lead that has calls linked cannot be deleted until they are unlinked', async () => {
      const lead = await mkLead(A);
      await entry(A, { lead_id: lead });
      await fails(h.db.getRepository(Lead).delete({ id: lead }), HAS_CHILD);
      await h.db.getRepository(CallLogEntry).update({ lead_id: lead }, { lead_id: null } as any);
      await expect(h.db.getRepository(Lead).delete({ id: lead })).resolves.toBeDefined();
    });
  });

  describe('reminders (a rep\'s promise to call back)', () => {
    const reminder = (co: Record<string, any>, extra: Record<string, any> = {}) =>
      h.db.getRepository(Reminder).insert({ company_id: co.id, lead_id: co.lead, user_id: co.rep, remind_at: new Date(Date.now() + 36e5), ...extra } as any);

    it('one promise per rep per lead; another rep may promise the same lead', async () => {
      await reminder(A);
      await fails(reminder(A), DUP);
      await expect(reminder(A, { user_id: A.rep2, reason: 'ask about price' })).resolves.toBeDefined();
    });
    it('cannot cross companies', async () => {
      await fails(reminder(A, { lead_id: B.lead, user_id: A.rep2 }), NO_PARENT);
      await fails(reminder(A, { user_id: B.rep, lead_id: await mkLead(A) }), NO_PARENT);
    });
  });

  describe('bookings', () => {
    it('stores the original fields and defaults', async () => {
      const lead = await mkLead(A);
      const id = (await booking(A, lead, { service_id: A.service, notes: 'ملاحظة', case_name: 'تقويم' })).identifiers[0].id;
      const row = await h.db.getRepository(Booking).findOneByOrFail({ id });
      expect(row).toMatchObject({ status: 'scheduled', reminder_no_answer_count: 0, reminder_call_at: null, reminder_outcome: null, notes: 'ملاحظة', case_name: 'تقويم' });
    });
    it('only the four statuses exist', async () => {
      for (const status of ['examined', 'no_show', 'cancelled', 'scheduled']) await expect(booking(A, await mkLead(A), { status })).resolves.toBeDefined();
      await fails(booking(A, await mkLead(A), { status: 'postponed' }), BAD_VALUE);
    });
    it("cannot use another company's lead, rep, reminder owner or service", async () => {
      await fails(booking(A, B.lead), NO_PARENT);
      await fails(booking(A, await mkLead(A), { booked_by_user_id: B.rep }), NO_PARENT);
      await fails(booking(A, await mkLead(A), { reminder_owner_user_id: B.rep }), NO_PARENT);
      await fails(booking(A, await mkLead(A), { service_id: B.service }), NO_PARENT);
    });
    it('a lead has at most ONE live (scheduled) booking, enforced by the database', async () => {
      const lead = await mkLead(A);
      await booking(A, lead);
      await fails(booking(A, lead), DUP);
      await fails(booking(A, lead, { status: 'scheduled' }), DUP);
    });
    it('finished bookings do not count: a lead can have many, and a new live one once the last is done', async () => {
      const lead = await mkLead(A);
      const first = (await booking(A, lead)).identifiers[0].id;
      await h.db.getRepository(Booking).update({ id: first }, { status: 'examined' } as any);
      await expect(booking(A, lead)).resolves.toBeDefined(); // a new visit
      await expect(booking(A, lead, { status: 'cancelled' })).resolves.toBeDefined();
      await expect(booking(A, lead, { status: 'cancelled' })).resolves.toBeDefined();
      await expect(booking(A, lead, { status: 'no_show' })).resolves.toBeDefined();
    });
    it("another company's lead may have its own live booking at the same time", async () => {
      const la = await mkLead(A);
      await booking(A, la);
      await expect(booking(B, await mkLead(B))).resolves.toBeDefined();
    });
    it('a lead with bookings cannot be deleted', async () => {
      const lead = await mkLead(A);
      await booking(A, lead);
      await fails(h.db.getRepository(Lead).delete({ id: lead }), HAS_CHILD);
    });
  });

  describe('booking_events (the trail)', () => {
    let bk: number;
    beforeAll(async () => { bk = (await booking(A, await mkLead(A))).identifiers[0].id; });
    const event = (extra: Record<string, any> = {}) =>
      h.db.getRepository(BookingEvent).insert({ company_id: A.id, booking_id: bk, kind: 'booked', ...extra } as any);

    it('records an event with an optional actor and detail', async () => {
      await expect(event()).resolves.toBeDefined();
      await expect(event({ kind: 'reminder_message', detail: 'sent', by_user_id: A.rep })).resolves.toBeDefined();
    });
    it("cannot belong to another company's booking or be attributed to another company's user", async () => {
      const bb = (await booking(B, await mkLead(B))).identifiers[0].id;
      await fails(event({ booking_id: bb }), NO_PARENT);
      await fails(event({ by_user_id: B.rep }), NO_PARENT);
    });
    it('a booking that has a trail cannot be deleted', async () => {
      await fails(h.db.getRepository(Booking).delete({ id: bk }), HAS_CHILD);
    });
  });

  describe('lead_handovers', () => {
    const handover = (extra: Record<string, any> = {}) =>
      h.db.getRepository(LeadHandover).insert({ company_id: A.id, lead_id: A.lead, reason: 'claimed', ...extra } as any);

    it('records who took it and why; either side may be empty (pool -> rep, rep -> pool)', async () => {
      const id = (await handover({ to_user_id: A.rep })).identifiers[0].id;
      expect((await h.db.getRepository(LeadHandover).findOneByOrFail({ id })).attempts).toBe(0);
      await expect(handover({ from_user_id: A.rep, reason: 'day_done', attempts: 2 })).resolves.toBeDefined();
      await expect(handover({ reason: 'promise_back' })).resolves.toBeDefined();
    });
    it("cannot involve another company's lead or people", async () => {
      await fails(handover({ lead_id: B.lead }), NO_PARENT);
      await fails(handover({ to_user_id: B.rep }), NO_PARENT);
      await fails(handover({ from_user_id: B.rep }), NO_PARENT);
    });
  });

  describe('claim_attempts', () => {
    it('records every tap, including blocked ones, with optional counts', async () => {
      for (const result of ['claimed', 'empty', 'blocked_window', 'blocked_hold', 'blocked_nolink', 'no_work']) {
        await expect(h.db.getRepository(ClaimAttempt).insert({ company_id: A.id, user_id: A.rep, result, requested: 10, claimed: 0 } as any)).resolves.toBeDefined();
      }
      await expect(h.db.getRepository(ClaimAttempt).insert({ company_id: A.id, user_id: A.rep, result: 'no_work' } as any)).resolves.toBeDefined();
    });
    it('belongs to a member of the company', async () => {
      await fails(h.db.getRepository(ClaimAttempt).insert({ company_id: A.id, user_id: B.rep, result: 'empty' } as any), NO_PARENT);
    });
  });

  describe('structural invariants of the history tables', () => {
    const HISTORY = ['call_results', 'call_log_entries', 'reminders', 'bookings', 'booking_events', 'lead_handovers', 'claim_attempts'];
    const list = HISTORY.map((t) => `'${t}'`).join(',');

    it('every table carries a NOT NULL company_id and is created by the migration', async () => {
      const rows = await h.db.query(
        `SELECT TABLE_NAME t, IS_NULLABLE n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'company_id' AND TABLE_NAME IN (${list})`,
      );
      expect(rows.map((r: any) => r.t).sort()).toEqual([...HISTORY].sort());
      for (const r of rows) expect([r.t, r.n]).toEqual([r.t, 'NO']);
    });
    it('bookings has UNIQUE (company_id, id), as call results and the trail point into it', async () => {
      const rows = await h.db.query(
        "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND NON_UNIQUE = 0 GROUP BY INDEX_NAME",
      );
      expect(rows.some((r: any) => r.c === 'company_id,id')).toBe(true);
    });
    it('every foreign key is the company link or a composite key starting with company_id', async () => {
      const fks = await h.db.query(
        `SELECT k.TABLE_NAME t, k.CONSTRAINT_NAME n, k.REFERENCED_TABLE_NAME r, GROUP_CONCAT(k.COLUMN_NAME ORDER BY k.ORDINAL_POSITION) c
           FROM information_schema.KEY_COLUMN_USAGE k
          WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME IN (${list}) AND k.REFERENCED_TABLE_NAME IS NOT NULL
          GROUP BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.REFERENCED_TABLE_NAME`,
      );
      expect(fks.length).toBeGreaterThan(18);
      for (const f of fks) {
        const ok = f.r === 'companies' ? f.c === 'company_id' : String(f.c).startsWith('company_id,');
        expect({ fk: f.n, ok }).toEqual({ fk: f.n, ok: true });
      }
    });
    it('history is never cascaded away: every rule is RESTRICT (the company link) and none SETs NULL', async () => {
      const rules = await h.db.query(
        `SELECT TABLE_NAME t, CONSTRAINT_NAME n, DELETE_RULE r, REFERENCED_TABLE_NAME ref FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME IN (${list})`,
      );
      for (const r of rules) expect([r.t, r.n, r.r]).toEqual([r.t, r.n, 'RESTRICT']);
      expect(rules.filter((r: any) => r.ref === 'companies').map((r: any) => r.t).sort()).toEqual([...HISTORY].sort());
    });
  });
});
