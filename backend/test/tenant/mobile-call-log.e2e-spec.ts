/**
 * B5.1/B5.2 — the rep's synced phone call log (/api/mobile/call-log/sync, /call-log/recent), its linking to
 * leads, and its effect on attempts and the lead timeline. Written before the implementation.
 */
import { bootstrap } from './harness';
import { Company } from '../../src/modules/companies/entities/company.entity';
import { Lead } from '../../src/modules/leads/entities/lead.entity';
import { LeadContact } from '../../src/modules/lead-contacts/entities/lead-contact.entity';
import { Doctor } from '../../src/modules/doctors/entities/doctor.entity';
import { UserDoctor } from '../../src/modules/doctors/entities/user-doctor.entity';
import { CallResult } from '../../src/modules/call-results/entities/call-result.entity';
import { CallLogEntry } from '../../src/modules/call-log/entities/call-log-entry.entity';
import { Subscription, SubscriptionStatus } from '../../src/modules/subscriptions/entities/subscription.entity';
import { Plan } from '../../src/modules/plans/entities/plan.entity';
import { PlanPrice, PriceInterval } from '../../src/modules/plan-prices/entities/plan-price.entity';

const DAY = 864e5;
const MIN = 60e3;
const minutesAgo = (m: number) => Date.now() - m * MIN;

describe('Mobile call log (/api/mobile)', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const ids: Record<string, any> = {};
  const mob: Record<string, number> = {};
  const P = { l1: '01021000001', l2: '01021000002', pool: '01021000004', alt: '01021000005', other: '01021000006', fresh: '01021000007', foreign: '+249912345678', b: '01021000003' };
  let deviceSeq = 5000;
  const repo = (e: any) => h.db.getRepository(e);
  const sync = (who: string, entries: any) => h.post(who, '/mobile/call-log/sync', { entries });
  const recent = (who: string, q = '') => h.get(who, `/mobile/call-log/recent${q}`);
  const entry = (phone: string, o: any = {}) => ({ deviceCallId: ++deviceSeq, phoneNumber: phone, direction: 'outbound', durationSeconds: 30, occurredAt: minutesAgo(10), cachedName: null, phoneAccountId: null, ...o });
  const rowsOf = (user: string) => repo(CallLogEntry).find({ where: { user_id: ids[user] }, order: { occurred_at: 'ASC' } });

  const mkContact = async (label: string, company: string, source: string, extra: any) => {
    const c = (await repo(LeadContact).save(repo(LeadContact).create({ company_id: company, lead_id: source, name: label, work_status: 'new', ...extra }) as any)) as any;
    ids[label] = c.id;
    mob[label] = (await repo(LeadContact).findOneByOrFail({ id: c.id })).mobile_id;
  };

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    const plan = await repo(Plan).save({ name: 'P', slug: `p-${Date.now()}`, is_active: true } as any);
    const price = await repo(PlanPrice).save({ plan_id: plan.id, amount: 1, currency: 'EGP', interval: PriceInterval.MONTH, is_active: true } as any);
    const mkCo = async (name: string, sub: any) => {
      const co = (await repo(Company).save(repo(Company).create({ name, status: 'active' } as any))) as any;
      await repo(Subscription).save({ company_id: co.id, plan_price_id: price.id, starts_at: new Date(), ...sub } as any);
      return co;
    };
    const ok = { status: SubscriptionStatus.ACTIVE, current_period_end: new Date(Date.now() + 30 * DAY) };
    const A = await mkCo('CL A', ok);
    const B = await mkCo('CL B', ok);
    const X = await mkCo('CL Expired', { status: SubscriptionStatus.EXPIRED, current_period_end: new Date(Date.now() - 40 * DAY) });
    Object.assign(ids, { A: A.id, B: B.id, X: X.id });
    for (const [k, co] of [['repA1', A], ['repA2', A], ['repB', B], ['repX', X]] as const) {
      ids[k] = (await h.mkUser(k, `cl-${k}@t.test`, co.id, 'sales')).id;
      h.tokenFor(k, ids[k]);
    }
    ids.docA = (await repo(Doctor).save({ company_id: A.id, name: 'Dr A' } as any)).id;
    await repo(UserDoctor).save({ company_id: A.id, user_id: ids.repA1, doctor_id: ids.docA, rank: 'primary' } as any);
    ids.srcA = (await repo(Lead).save({ company_id: A.id, name: 'Src A', source_type: 'manual', doctor_id: ids.docA } as any)).id;
    ids.srcB = (await repo(Lead).save({ company_id: B.id, name: 'Src B', source_type: 'manual' } as any)).id;
    const now = new Date(Date.now() - 2 * 3600e3);
    const mine = { assigned_user_id: ids.repA1, claimed_at: now, first_claimed_at: now };
    await mkContact('L1', A.id, ids.srcA, { ...mine, phone: P.l1 });
    await mkContact('L2', A.id, ids.srcA, { assigned_user_id: ids.repA2, claimed_at: now, first_claimed_at: now, phone: P.l2 });
    await mkContact('Pool', A.id, ids.srcA, { assigned_user_id: null, phone: P.pool, work_status: 'new' });
    await mkContact('WithAlt', A.id, ids.srcA, { ...mine, phone: '01021000099', alt_phone: P.alt });
    await mkContact('Foreign', A.id, ids.srcA, { ...mine, phone: P.foreign });
    await mkContact('LB', B.id, ids.srcB, { assigned_user_id: ids.repB, claimed_at: now, first_claimed_at: now, phone: P.b });
    // rep A1 once worked the pool lead and L2 (so "worked before" ranks them)
    await repo(CallResult).save(repo(CallResult).create({ company_id: A.id, lead_contact_id: ids.Pool, user_id: ids.repA1, outcome: 'no_answer', kind: 'lead', created_at: new Date(Date.now() - 3 * DAY) } as any));
  });
  afterAll(async () => { await h.app?.close(); });

  describe('POST /call-log/sync', () => {
    it('stores entries in the canonical number shape, links the rep\'s own lead, and reports the counts', async () => {
      const res = await sync('repA1', [entry('+20 10 2100 0001', { direction: 'outbound', durationSeconds: 45, cachedName: 'ليد ١', phoneAccountId: 'sim-1' })]);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, synced: 1, updated: 0, skipped: 0, skippedDetail: [] });
      const [row] = await rowsOf('repA1');
      expect(row).toMatchObject({ company_id: ids.A, phone_number: P.l1, direction: 'outbound', duration_seconds: 45, cached_name: 'ليد ١', phone_account_id: 'sim-1', lead_contact_id: ids.L1 });
      expect(typeof row.occurred_at).toBe('number');
      expect(Number.isInteger(row.mobile_id)).toBe(true);
    });

    it('is idempotent: re-sending the same window changes nothing', async () => {
      const batch = [entry(P.l1, { occurredAt: minutesAgo(50) }), entry(P.l1, { occurredAt: minutesAgo(40), direction: 'missed', durationSeconds: 0 })];
      expect((await sync('repA1', batch)).body).toMatchObject({ synced: 2, updated: 0 });
      const again = await sync('repA1', batch);
      expect(again.body).toMatchObject({ synced: 0, updated: 0, skipped: 0 });
      const withoutIds = batch.map(({ deviceCallId, ...rest }) => rest);
      expect((await sync('repA1', withoutIds)).body).toMatchObject({ synced: 0, updated: 0 }); // an older build, no device ids
    });

    it('two different calls stamped in the same second are two rows, and a resync of them still adds nothing', async () => {
      const t = minutesAgo(120);
      const pair = [entry(P.l1, { occurredAt: t, deviceCallId: undefined }), entry(P.l1, { occurredAt: t, deviceCallId: undefined, direction: 'missed', durationSeconds: 0 })];
      expect((await sync('repA1', pair)).body).toMatchObject({ synced: 2 });
      expect((await sync('repA1', pair)).body).toMatchObject({ synced: 0, updated: 0 });
      expect((await repo(CallLogEntry).find({ where: { user_id: ids.repA1, occurred_at: t as any } })).length).toBe(2);
    });

    it('the device\'s later report wins (corrects direction and duration) and a lead link is never dropped', async () => {
      const e = entry(P.l1, { occurredAt: minutesAgo(200), direction: 'missed', durationSeconds: 900 });
      await sync('repA1', [e]);
      const fixed = await sync('repA1', [{ ...e, direction: 'outbound', durationSeconds: 60 }]);
      expect(fixed.body).toMatchObject({ synced: 0, updated: 1 });
      const row = await repo(CallLogEntry).findOneByOrFail({ user_id: ids.repA1, device_call_id: e.deviceCallId } as any);
      expect(row).toMatchObject({ direction: 'outbound', duration_seconds: 60, lead_contact_id: ids.L1 });
      await repo(LeadContact).update(ids.L1, { assigned_user_id: null } as any); // the lead is unassigned during a resync
      await sync('repA1', [{ ...e, durationSeconds: 61 }]);
      expect((await repo(CallLogEntry).findOneByOrFail({ id: row.id })).lead_contact_id).toBe(ids.L1);
      await repo(LeadContact).update(ids.L1, { assigned_user_id: ids.repA1 } as any);
    });

    it('refuses bad rows one by one, says why, and still stores the good ones', async () => {
      const good = entry(P.l2, { occurredAt: minutesAgo(5) });
      const res = await sync('repA1', [
        { ...entry(P.l1), phoneNumber: 'abc' },
        { ...entry(P.l1), direction: 'sideways' },
        { ...entry(P.l1), occurredAt: 'soon' },
        entry(P.l1, { occurredAt: Date.now() + 2 * 3600e3 }), // two hours ahead: a forged/very wrong clock
        entry(P.l1, { occurredAt: Date.now() - 15 * DAY }), // older than the evidence could ever need
        entry(P.l1, { occurredAt: Date.now() + 30 * MIN }), // a phone 30 minutes fast is tolerated
        good,
      ]);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ synced: 2, skipped: 5 });
      expect(res.body.skippedDetail.map((d: any) => d.reason)).toEqual(['malformed', 'malformed', 'malformed', 'future', 'too_old']);
    });

    it('a newer app build adding a field, or a junk entry in the list, never fails the batch', async () => {
      const res = await sync('repA1', [{ ...entry(P.fresh, { occurredAt: minutesAgo(400) }), someFutureField: 'x' }, 42, null, 'junk']);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ synced: 1, skipped: 3 });
      expect(res.body.skippedDetail.map((d: any) => d.reason)).toEqual(['malformed', 'malformed', 'malformed']);
    });

    it('rejects a body that is not a list, or longer than 200 entries, with the legacy messages', async () => {
      const notList = await h.post('repA1', '/mobile/call-log/sync', { entries: 'x' });
      expect(notList.status).toBe(400);
      expect(notList.body.error).toBe('entries لازم تكون مصفوفة');
      const tooMany = await sync('repA1', Array.from({ length: 201 }, () => entry(P.l1)));
      expect(tooMany.status).toBe(400);
      expect(tooMany.body.error).toBe('أقصى عدد في المرة الواحدة 200');
    });

    it('accepts a full 200-entry batch that is larger than the default 100 KB body limit', async () => {
      const big = Array.from({ length: 200 }, (_, i) => entry(P.fresh, { occurredAt: minutesAgo(300 + i), cachedName: 'ن'.repeat(250) }));
      expect(Buffer.byteLength(JSON.stringify({ entries: big }))).toBeGreaterThan(100 * 1024); // bytes, as the body limit counts them
      const res = await sync('repA1', big);
      expect(res.status).toBe(200);
      expect(res.body.synced).toBe(200);
    });

    it('clips absurd durations, defaults a missing one to 0, and tolerates a missing device id', async () => {
      await sync('repA1', [entry(P.other, { durationSeconds: 99999999, occurredAt: minutesAgo(11) }), entry(P.other, { durationSeconds: undefined, deviceCallId: undefined, occurredAt: minutesAgo(12) })]);
      const rows = await repo(CallLogEntry).find({ where: { user_id: ids.repA1, phone_number: P.other } });
      expect(rows.map((r) => r.duration_seconds).sort((a, b) => a - b)).toEqual([0, 6 * 3600]);
    });
  });

  describe('linking calls to leads, inside the company only', () => {
    it('prefers the lead I hold, then one I worked, then any lead (holder first, newest)', async () => {
      await sync('repA1', [entry(P.l2, { occurredAt: minutesAgo(61) })]); // a colleague's lead nobody on my side worked
      await sync('repA1', [entry(P.pool, { occurredAt: minutesAgo(62) })]); // the pool lead I worked before
      const byNumber = async (n: string) => (await repo(CallLogEntry).findOneByOrFail({ user_id: ids.repA1, phone_number: n } as any)).lead_contact_id;
      expect(await byNumber(P.l2)).toBe(ids.L2); // anyone's lead: the call is the lead's, whoever holds it
      expect(await byNumber(P.pool)).toBe(ids.Pool);
    });

    it('matches the second number, and foreign numbers by their last ten digits', async () => {
      await sync('repA1', [entry(P.alt, { occurredAt: minutesAgo(63) }), entry('00249912345678', { occurredAt: minutesAgo(64) })]);
      expect((await repo(CallLogEntry).findOneByOrFail({ user_id: ids.repA1, phone_number: P.alt } as any)).lead_contact_id).toBe(ids.WithAlt);
      expect((await repo(CallLogEntry).findOneByOrFail({ user_id: ids.repA1, phone_number: '249912345678' } as any)).lead_contact_id).toBe(ids.Foreign);
    });

    it('never links to another company\'s lead, even with the same number', async () => {
      await sync('repA1', [entry(P.b, { occurredAt: minutesAgo(65) })]); // company B's lead number, synced by a company A rep
      const row = await repo(CallLogEntry).findOneByOrFail({ user_id: ids.repA1, phone_number: P.b } as any);
      expect(row.lead_contact_id).toBeNull();
      expect(row.company_id).toBe(ids.A);
    });

    it('calls synced before the lead existed attach when it is created, but only within the company', async () => {
      await sync('repA1', [entry('01021000071', { occurredAt: minutesAgo(70) })]);
      await sync('repB', [entry('01021000071', { occurredAt: minutesAgo(71) })]); // company B, same number, no lead yet
      const created = await h.post('repA1', '/mobile/leads', { name: 'جديد', phone: '01021000071' });
      expect(created.status).toBe(201);
      const aRow = await repo(CallLogEntry).findOneByOrFail({ user_id: ids.repA1, phone_number: '01021000071' } as any);
      expect(aRow.lead_contact_id).not.toBeNull();
      const bRow = await repo(CallLogEntry).findOneByOrFail({ user_id: ids.repB, phone_number: '01021000071' } as any);
      expect(bRow.lead_contact_id).toBeNull();
    });

    it('a second number the rep adds picks up the calls already made to it', async () => {
      await sync('repA1', [entry('01021000072', { occurredAt: minutesAgo(72) })]);
      const patch = await h.patch('repA1', `/mobile/leads/${mob.L1}`, { altPhone: '01021000072' });
      expect(patch.status).toBe(200);
      expect((await repo(CallLogEntry).findOneByOrFail({ user_id: ids.repA1, phone_number: '01021000072' } as any)).lead_contact_id).toBe(ids.L1);
    });
  });

  describe('GET /call-log/recent', () => {
    it('lists my own calls, newest first, in the legacy shape, with the lead\'s current name', async () => {
      const res = await recent('repA1', '?limit=500');
      expect(res.status).toBe(200);
      const entries: any[] = res.body.entries;
      expect(entries.length).toBe(100); // limit clamped to 100
      const times = entries.map((e) => e.occurredAt);
      expect([...times].sort((a, b) => b - a)).toEqual(times);
      const linked = entries.find((e) => e.leadId === mob.L1)!;
      expect(linked).toMatchObject({ phoneNumber: P.l1, leadName: 'L1' });
      expect(Number.isInteger(linked.id)).toBe(true);
      expect(typeof linked.occurredAt).toBe('number');
      for (const k of ['direction', 'durationSeconds', 'cachedName', 'phoneAccountId']) expect(linked).toHaveProperty(k);
      expect(Object.keys(linked)).not.toContain('company_id');
    });

    it('defaults to 30 and treats junk as the default; other reps and companies never appear', async () => {
      expect((await recent('repA1')).body.entries).toHaveLength(30);
      expect((await recent('repA1', '?limit=abc')).body.entries).toHaveLength(30);
      expect((await recent('repA1', '?limit=0')).body.entries).toHaveLength(30);
      expect((await recent('repA1', '?limit=1')).body.entries).toHaveLength(1);
      const a2 = await recent('repA2');
      expect(a2.body.entries).toEqual([]);
      const b = (await recent('repB')).body.entries;
      expect(b.every((e: any) => e.phoneNumber === '01021000071')).toBe(true); // only repB's own call
      expect(JSON.stringify(b)).not.toContain('"leadName":"L1"');
    });
  });

  describe('the call log feeds the lead timeline and the attempts', () => {
    it('real dials raise today\'s attempts and move the next action (inbound and missed calls do not)', async () => {
      const now = Date.now();
      await sync('repA1', [
        entry(P.alt, { occurredAt: now - 5 * MIN }), entry(P.alt, { occurredAt: now - 4 * MIN }),
        entry(P.alt, { occurredAt: now - 3 * MIN, direction: 'inbound', durationSeconds: 40 }),
        entry(P.alt, { occurredAt: now - 2 * MIN, direction: 'missed', durationSeconds: 0 }),
      ]);
      const lead = (await h.get('repA1', '/mobile/leads')).body.leads.find((l: any) => l.id === mob.WithAlt);
      expect(lead).toMatchObject({ attemptsToday: 3 /* the earlier 63-minute-old dial + these two */, attemptDays: 1 });
      expect(lead.nextAction.action).toBe('wait_tomorrow');
      expect(lead.callCount).toBeGreaterThanOrEqual(3); // the card shows the larger of outcomes and dials
      expect(lead.outcomeCount).toBe(0);
    });

    it('the activity timeline lists the phone calls and the client\'s inbound calls', async () => {
      const res = await h.get('repA1', `/mobile/leads/${mob.WithAlt}/activity`);
      expect(res.status).toBe(200);
      const { phoneCalls, events, counts } = res.body;
      expect(phoneCalls.length).toBeGreaterThanOrEqual(4);
      expect(phoneCalls[0]).toMatchObject({ direction: 'missed', directionLabel: 'فايتة', matched: true });
      expect(phoneCalls.map((c: any) => c.occurredAt)).toEqual([...phoneCalls.map((c: any) => c.occurredAt)].sort((a, b) => b - a));
      const inbound = events.filter((e: any) => e.type === 'inbound_call').map((e: any) => e.label);
      expect(inbound).toContain('العميل اتصل واترد عليه (40ث)');
      expect(inbound).toContain('العميل اتصل ومحدش رد');
      expect(counts.dials).toBe(phoneCalls.filter((c: any) => c.direction === 'outbound' && c.matched).length);
    });

    it('an unlinked call to one of the lead\'s numbers still shows, as unmatched, and never from another company', async () => {
      await sync('repA2', [entry('01021000099', { occurredAt: minutesAgo(9) })]); // the lead's contact number; a colleague's phone log
      const own = await h.get('repA1', `/mobile/leads/${mob.WithAlt}/activity`);
      expect(own.body.phoneCalls.length).toBeGreaterThanOrEqual(4);
      await sync('repB', [entry(P.alt, { occurredAt: minutesAgo(8) })]); // company B calls the same second number
      const after = await h.get('repA1', `/mobile/leads/${mob.WithAlt}/activity`);
      expect(after.body.phoneCalls.every((c: any) => c.repName !== 'repB')).toBe(true);
    });
  });

  describe('rules for every call-log route', () => {
    it('an expired company is blocked with the legacy-shaped 402; a token is required', async () => {
      for (const res of [await sync('repX', [entry(P.l1)]), await recent('repX')]) {
        expect(res.status).toBe(402);
        expect(res.body.code).toBe('SUBSCRIPTION_EXPIRED');
        expect(typeof res.body.error).toBe('string');
      }
      expect((await h.http().post('/api/mobile/call-log/sync').send({ entries: [] })).status).toBe(401);
      expect((await h.http().get('/api/mobile/call-log/recent')).status).toBe(401);
    });

    it('the whitelist refuses unknown top-level fields', async () => {
      const res = await h.post('repA1', '/mobile/call-log/sync', { entries: [], company_id: ids.B });
      expect(res.status).toBe(400);
    });
  });
});
