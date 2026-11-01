/**
 * B2.3 — mobile lead read endpoints (/api/mobile): GET /leads, /leads/:id, /leads/history,
 * /leads/:id/activity, /my/doctors, /services. Written before the implementation.
 * Wire shape = the legacy backend's, so the Android parsers keep working unchanged.
 */
import { bootstrap } from './harness';
import { Company } from '../../src/modules/companies/entities/company.entity';
import { Lead } from '../../src/modules/leads/entities/lead.entity';
import { LeadContact } from '../../src/modules/lead-contacts/entities/lead-contact.entity';
import { Service, ServiceStatus } from '../../src/modules/services/entities/service.entity';
import { Doctor } from '../../src/modules/doctors/entities/doctor.entity';
import { UserDoctor } from '../../src/modules/doctors/entities/user-doctor.entity';
import { CallResult } from '../../src/modules/call-results/entities/call-result.entity';
import { Subscription, SubscriptionStatus } from '../../src/modules/subscriptions/entities/subscription.entity';
import { Plan } from '../../src/modules/plans/entities/plan.entity';
import { PlanPrice, PriceInterval } from '../../src/modules/plan-prices/entities/plan-price.entity';

const DAY = 864e5;
const STAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const hours = (h: number) => new Date(Date.now() - h * 3600e3);
const days = (d: number) => new Date(Date.now() - d * DAY);

describe('Mobile lead reads (/api/mobile)', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const ids: Record<string, any> = {};
  const mob: Record<string, number> = {}; // mobile ids by label
  let seq = 0;
  const n = () => `${Date.now()}${++seq}`;

  const get = (who: string, url: string) => h.get(who, `/mobile${url}`);
  const repo = (e: any) => h.db.getRepository(e);

  const mkContact = async (label: string, company_id: string, lead_id: string, extra: any) => {
    const c = (await repo(LeadContact).save(
      repo(LeadContact).create({ company_id, lead_id, name: label, phone: `0100${String(++seq).padStart(7, '0')}`, ...extra }) as any,
    )) as any;
    ids[label] = c.id;
    mob[label] = (await repo(LeadContact).findOneByOrFail({ id: c.id })).mobile_id;
    return c;
  };
  const result = (label: string, user: string, outcome: string, at: Date, kind = 'lead', company = ids.A) =>
    repo(CallResult).save(repo(CallResult).create({ company_id: company, lead_contact_id: ids[label], user_id: ids[user], outcome, kind, created_at: at } as any));

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    const plan = await repo(Plan).save({ name: 'P', slug: `p-${n()}`, is_active: true } as any);
    const price = await repo(PlanPrice).save({ plan_id: plan.id, amount: 1, currency: 'EGP', interval: PriceInterval.MONTH, is_active: true } as any);
    const mkCo = async (name: string, sub: any) => {
      const co = await repo(Company).save(repo(Company).create({ name, status: 'active' } as any)) as any;
      if (sub) await repo(Subscription).save({ company_id: co.id, plan_price_id: price.id, starts_at: new Date(), ...sub } as any);
      return co;
    };
    const active = { status: SubscriptionStatus.ACTIVE, current_period_end: new Date(Date.now() + 30 * DAY) };
    const A = await mkCo('ML A', active);
    const B = await mkCo('ML B', active);
    const X = await mkCo('ML Expired', { status: SubscriptionStatus.EXPIRED, current_period_end: days(40) });
    Object.assign(ids, { A: A.id, B: B.id, X: X.id });
    ids.repA1 = (await h.mkUser('Rep A1', 'ml-a1@t.test', A.id, 'sales')).id;
    ids.repA2 = (await h.mkUser('Rep A2', 'ml-a2@t.test', A.id, 'sales')).id;
    ids.ceoA = (await h.mkUser('CEO A', 'ml-owner@t.test', A.id, 'owner')).id;
    ids.repB = (await h.mkUser('Rep B', 'ml-b@t.test', B.id, 'sales')).id;
    ids.repX = (await h.mkUser('Rep X', 'ml-x@t.test', X.id, 'sales')).id;
    for (const k of ['repA1', 'repA2', 'ceoA', 'repB', 'repX']) h.tokenFor(k, ids[k]);

    ids.docA1 = (await repo(Doctor).save({ company_id: A.id, name: 'د. أحمد' } as any)).id;
    ids.docA2 = (await repo(Doctor).save({ company_id: A.id, name: 'د. سارة' } as any)).id;
    ids.docB = (await repo(Doctor).save({ company_id: B.id, name: 'Dr B' } as any)).id;
    for (const k of ['docA1', 'docA2', 'docB']) mob[k] = (await repo(Doctor).findOneByOrFail({ id: ids[k] })).mobile_id;
    await repo(UserDoctor).save({ company_id: A.id, user_id: ids.repA1, doctor_id: ids.docA2, rank: 'secondary' } as any);
    await repo(UserDoctor).save({ company_id: A.id, user_id: ids.repA1, doctor_id: ids.docA1, rank: 'primary' } as any);
    // a link row pointing at ANOTHER company's doctor must never be served
    await repo(UserDoctor).save({ company_id: A.id, user_id: ids.repA1, doctor_id: ids.docB, rank: 'tertiary' } as any);

    ids.srcA = (await repo(Lead).save({ company_id: A.id, name: 'Campaign A', source_type: 'manual', doctor_id: ids.docA1 } as any)).id;
    ids.srcB = (await repo(Lead).save({ company_id: B.id, name: 'Campaign B', source_type: 'manual', doctor_id: ids.docB } as any)).id;
    ids.svcA1 = (await repo(Service).save({ company_id: A.id, name: 'تقويم', price: 1, currency: 'EGP' } as any)).id;
    await repo(Service).save({ company_id: A.id, name: 'Old service', price: 1, currency: 'EGP', status: ServiceStatus.INACTIVE } as any);
    await repo(Service).save({ company_id: B.id, name: 'B service', price: 1, currency: 'EGP' } as any);
    mob.svcA1 = (await repo(Service).findOneByOrFail({ id: ids.svcA1 })).mobile_id;

    const claimed = hours(2);
    await mkContact('c1', A.id, ids.srcA, { assigned_user_id: ids.repA1, claimed_at: claimed, first_claimed_at: claimed, work_status: 'new', service_id: ids.svcA1, notes: 'ملاحظة', alt_name: 'أخوه', alt_phone: '01012345678', whatsapp_phone: '01098765432', whatsapp_count: 1, whatsapp_sent_at: hours(1), created_at: days(1) });
    await mkContact('c2', A.id, ids.srcA, { assigned_user_id: ids.repA1, claimed_at: claimed, first_claimed_at: claimed, work_status: 'no_answer', created_at: days(2) });
    await mkContact('c3', A.id, ids.srcA, { assigned_user_id: ids.repA1, claimed_at: days(3), first_claimed_at: days(3), work_status: 'not_interested', created_at: days(4) });
    await mkContact('c4', A.id, ids.srcA, { assigned_user_id: ids.repA1, claimed_at: days(20), first_claimed_at: days(20), work_status: 'unreachable', created_at: days(21), name: 'عبدالله سيد' });
    await mkContact('c5', A.id, ids.srcA, { assigned_user_id: ids.repA1, claimed_at: null, work_status: 'new', created_at: days(1), name: 'هبة محمد' });
    await mkContact('c6', A.id, ids.srcA, { assigned_user_id: ids.repA2, claimed_at: claimed, first_claimed_at: claimed, work_status: 'no_answer', created_at: days(1), name: 'أحمد علي' });
    await mkContact('c7', B.id, ids.srcB, { assigned_user_id: ids.repB, claimed_at: claimed, first_claimed_at: claimed, work_status: 'new', created_at: days(1), name: 'Secret B Lead' });
    // inconsistent data on purpose: a company B lead assigned to a company A rep must still be invisible to them
    await mkContact('c9', B.id, ids.srcB, { assigned_user_id: ids.repA1, claimed_at: claimed, first_claimed_at: claimed, work_status: 'new', created_at: days(1), name: 'Cross Tenant Lead' });
    await mkContact('c8', A.id, ids.srcA, { assigned_user_id: ids.repA2, claimed_at: days(30), first_claimed_at: days(30), work_status: 'not_interested', created_at: days(31), name: 'Colleague Old' });

    // c2: two calls today (quota spent); c6 belongs to rep A2; c4 and c8 were called by rep A1 (c8 is now rep A2's)
    await result('c2', 'repA1', 'no_answer', hours(1.5));
    await result('c2', 'repA1', 'no_answer', hours(1));
    await result('c4', 'repA1', 'unreachable', days(20));
    await result('c6', 'repA2', 'no_answer', hours(1));
    await result('c8', 'repA1', 'not_interested', days(30));
    await result('c1', 'repA1', 'follow_up', hours(0.5), 'manual');
    // another company's activity, identical shape, must never be visible
    await result('c7', 'repB', 'no_answer', hours(1), 'lead', B.id);
  });
  afterAll(async () => { await h.app?.close(); });

  describe('GET /leads', () => {
    it("returns the rep's claimed, still-relevant leads in the legacy shape", async () => {
      const res = await get('repA1', '/leads');
      expect(res.status).toBe(200);
      const leads: any[] = res.body.leads;
      expect(leads.map((l) => l.id).sort()).toEqual([mob.c1, mob.c2, mob.c3].sort());
      const c1 = leads.find((l) => l.id === mob.c1);
      expect(c1).toMatchObject({
        id: mob.c1, name: 'c1', status: 'new', whatsappPhone: '01098765432', whatsappCount: 1, notes: 'ملاحظة',
        altName: 'أخوه', altPhone: '01012345678', doctorId: mob.docA1, doctorName: 'د. أحمد', serviceName: 'تقويم',
        activeBookingId: null, activeBookingAt: null, caseName: null, callCount: 0,
        attemptsToday: 0, attemptsTotal: 0, attemptDays: 0,
        nextAction: { action: 'call', label: 'اتصل', callsLeftToday: 2, dayIndex: 0 },
      });
      expect(typeof c1.phone).toBe('string');
      expect(c1.claimed_at).toMatch(STAMP);
      expect(c1.whatsapp_sent_at).toMatch(STAMP);
      expect(Number.isInteger(c1.id)).toBe(true);
      expect(Object.keys(c1)).not.toContain('company_id'); // no tenant internals on the wire
    });

    it('derives attempts and the next action from call history', async () => {
      const c2 = (await get('repA1', '/leads')).body.leads.find((l: any) => l.id === mob.c2);
      expect(c2).toMatchObject({ attemptsToday: 2, attemptsTotal: 2, attemptDays: 1, callCount: 2, outcomeCount: 2 });
      expect(c2.nextAction.action).toBe('wait_tomorrow');
      const c1 = (await get('repA1', '/leads')).body.leads.find((l: any) => l.id === mob.c1);
      expect(c1.callCount).toBe(0); // a manual outcome is not a call
    });

    it('keeps a finished lead for a week, then moves it to history; unclaimed leads are not listed', async () => {
      const list = (await get('repA1', '/leads')).body.leads;
      expect(list.some((l: any) => l.id === mob.c3)).toBe(true); // closed 3 days ago
      expect(list.some((l: any) => l.id === mob.c4)).toBe(false); // closed 20 days ago
      expect(list.some((l: any) => l.id === mob.c5)).toBe(false); // assigned but never claimed
    });

    it('lists yesterday\'s silent numbers first', async () => {
      // c2 already has its two calls today, so it does not jump the queue; ordering stays newest first
      const order = (await get('repA1', '/leads')).body.leads.map((l: any) => l.id);
      expect(order).toEqual([mob.c1, mob.c2, mob.c3]);
    });

    it('a lead of another company is never listed, even if it is (wrongly) assigned to this rep', async () => {
      const ids1 = (await get('repA1', '/leads')).body.leads.map((l: any) => l.id);
      expect(ids1).not.toContain(mob.c9);
      expect((await get('repA1', `/leads/${mob.c9}`)).status).toBe(404);
      expect((await get('repA1', `/leads/${mob.c9}/activity`)).status).toBe(404);
      const search = await get('repA1', `/leads/history?q=${encodeURIComponent('Cross Tenant')}`);
      expect(search.body.leads).toEqual([]);
    });

    it('each rep sees only their own; a colleague, a manager and another company see none of them', async () => {
      const a2 = (await get('repA2', '/leads')).body.leads.map((l: any) => l.id);
      expect(a2).toEqual([mob.c6]);
      expect((await get('repB', '/leads')).body.leads.map((l: any) => l.id)).toEqual([mob.c7]);
      expect((await get('ceoA', '/leads')).body.leads).toEqual([]);
    });
  });

  describe('GET /leads/:id', () => {
    it('returns one of my leads as {lead}', async () => {
      const res = await get('repA1', `/leads/${mob.c1}`);
      expect(res.status).toBe(200);
      expect(res.body.lead).toMatchObject({ id: mob.c1, name: 'c1', nextAction: { action: 'call' } });
    });

    it.each([['a colleague\'s lead', 'c6'], ["another company's lead", 'c7'], ['an unknown id', null]])('404 with the legacy message for %s', async (_n, label) => {
      const res = await get('repA1', `/leads/${label ? mob[label] : 999999}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('الليد ده مبقاش في قايمتك');
      expect(JSON.stringify(res.body)).not.toContain('Secret B Lead');
    });

    it('a non-numeric id is a clean 4xx with an error message', async () => {
      const res = await get('repA1', '/leads/abc');
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(typeof res.body.error).toBe('string');
    });
  });

  describe('GET /leads/history', () => {
    it('without a query: finished leads older than a week, paged', async () => {
      const res = await get('repA1', '/leads/history');
      expect(res.status).toBe(200);
      expect(res.body.leads.map((l: any) => l.id)).toEqual([mob.c4]);
      expect(res.body).toMatchObject({ page: 1, pageSize: 50, total: 1, hasMore: false, q: null });
      expect(res.body.leads[0]).toMatchObject({ mine: true, ownerName: 'Rep A1' });
    });

    it('clamps the page size and treats junk paging as defaults', async () => {
      expect((await get('repA1', '/leads/history?pageSize=100000')).body.pageSize).toBe(200);
      expect((await get('repA1', '/leads/history?pageSize=0')).body.pageSize).toBe(50);
      expect((await get('repA1', '/leads/history?page=abc&pageSize=xyz')).body).toMatchObject({ page: 1, pageSize: 50 });
    });

    it('with a query: every lead the rep held or called, including a colleague\'s now', async () => {
      const res = await get('repA1', `/leads/history?q=${encodeURIComponent('Colleague')}`);
      expect(res.body.leads.map((l: any) => l.id)).toEqual([mob.c8]);
      expect(res.body.leads[0]).toMatchObject({ mine: false, ownerName: 'Rep A2' }); // rep A1 called it, rep A2 holds it
      expect(res.body.q).toBe('Colleague');
    });

    it.each([
      ['عبد الله سيد', 'c4'], // typed with a space
      ['عبدالله', 'c4'],
      ['هبه محمد', 'c5'], // ه for ة
      ['احمد', 'c6'], // plain alef for أ ... but c6 belongs to rep A2 and was never touched by rep A1
    ])('searches Arabic the way people type it: %s', async (q, label) => {
      const res = await get('repA1', `/leads/history?q=${encodeURIComponent(q)}`);
      const found = res.body.leads.map((l: any) => l.id);
      if (label === 'c6') expect(found).not.toContain(mob.c6);
      else expect(found).toContain(mob[label]);
    });

    it('searches by phone digits in any of the three numbers', async () => {
      const byAlt = await get('repA1', '/leads/history?q=01012345678');
      expect(byAlt.body.leads.map((l: any) => l.id)).toContain(mob.c1);
      const byWa = await get('repA1', '/leads/history?q=98765432');
      expect(byWa.body.leads.map((l: any) => l.id)).toContain(mob.c1);
    });

    it("never searches into another company or a colleague's untouched leads", async () => {
      for (const q of ['Secret', 'B Lead', 'أحمد علي']) {
        const res = await get('repA1', `/leads/history?q=${encodeURIComponent(q)}`);
        expect(JSON.stringify(res.body)).not.toContain('Secret B Lead');
        expect(res.body.leads.map((l: any) => l.id)).not.toContain(mob.c7);
        expect(res.body.leads.map((l: any) => l.id)).not.toContain(mob.c6);
      }
      const b = await get('repB', `/leads/history?q=${encodeURIComponent('عبدالله')}`); // a name that exists only in company A
      expect(b.body.leads).toEqual([]);
      const byDigits = await get('repB', `/leads/history?q=${encodeURIComponent('0100')}`); // digits of company A's numbers
      expect(byDigits.body.leads.map((l: any) => l.id)).toEqual([mob.c7]); // only B's own lead
    });
  });

  describe('GET /leads/:id/activity', () => {
    it("builds the lead's story from calls, the WhatsApp and the written contact", async () => {
      await repo(LeadContact).update(ids.c2, { client_contact_at: hours(0.2), client_contact_via: 'whatsapp', client_contact_note: 'رد على الرسالة', whatsapp_sent_at: hours(0.9) } as any);
      const res = await get('repA1', `/leads/${mob.c2}/activity`);
      expect(res.status).toBe(200);
      const { events, phoneCalls, counts } = res.body;
      expect(events.map((e: any) => e.type)).toEqual(['call', 'call', 'whatsapp', 'written_contact']);
      expect(events[0]).toMatchObject({ label: 'لم يرد', repName: 'Rep A1' });
      expect(events[0].time).toMatch(STAMP);
      expect(events[2]).toMatchObject({ label: 'اتبعتت رسالة واتساب', repName: null });
      expect(events[3].label).toBe('العميل رد على واتساب — رد على الرسالة');
      expect(phoneCalls).toEqual([]);
      expect(counts.outcomes).toBe(2);
    });

    it('a manual outcome is a status update, not a call', async () => {
      const res = await get('repA1', `/leads/${mob.c1}/activity`);
      expect(res.body.events.some((e: any) => e.type === 'status_update' && e.label === 'متابعة لاحقة')).toBe(true);
    });

    it("404 for a colleague's or another company's lead", async () => {
      expect((await get('repA1', `/leads/${mob.c6}/activity`)).status).toBe(404);
      const other = await get('repA1', `/leads/${mob.c7}/activity`);
      expect(other.status).toBe(404);
      expect(JSON.stringify(other.body)).not.toMatch(/Rep B|Secret/);
    });
  });

  describe('GET /my/doctors and /services', () => {
    it('lists my doctors in slot order, never another company\'s', async () => {
      const res = await get('repA1', '/my/doctors');
      expect(res.status).toBe(200);
      expect(res.body.doctors).toEqual([
        { id: mob.docA1, name: 'د. أحمد' },
        { id: mob.docA2, name: 'د. سارة' },
      ]);
      expect(JSON.stringify(res.body)).not.toContain('Dr B');
      expect((await get('repA2', '/my/doctors')).body.doctors).toEqual([]);
    });

    it("lists only my company's active services, with integer ids", async () => {
      const res = await get('repA1', '/services');
      expect(res.status).toBe(200);
      expect(res.body.services).toEqual([{ id: mob.svcA1, name: 'تقويم' }]);
      const b = await get('repB', '/services');
      expect(b.body.services.map((s: any) => s.name)).toEqual(['B service']);
    });
  });

  describe('subscription and auth rules apply', () => {
    it('an expired company gets the legacy-shaped 402 on every read', async () => {
      for (const url of ['/leads', `/leads/${mob.c1}`, '/leads/history', '/my/doctors', '/services']) {
        const res = await get('repX', url);
        expect(res.status).toBe(402);
        expect(res.body.code).toBe('SUBSCRIPTION_EXPIRED');
        expect(typeof res.body.error).toBe('string');
      }
    });

    it('needs a valid token', async () => {
      for (const url of ['/leads', '/leads/history', '/my/doctors', '/services']) {
        expect((await h.http().get(`/api/mobile${url}`)).status).toBe(401);
      }
    });
  });

  describe('timestamps are UTC text, independent of the server timezone', () => {
    it('writes and reads back the same instant and emits the legacy "YYYY-MM-DD HH:MM:SS" UTC text', async () => {
      const instant = new Date('2026-08-23T06:00:00Z');
      await repo(LeadContact).update(ids.c1, { claimed_at: instant } as any);
      const stored = await repo(LeadContact).findOneByOrFail({ id: ids.c1 });
      expect(stored.claimed_at!.getTime()).toBe(instant.getTime());
      const res = await get('repA1', `/leads/${mob.c1}`);
      expect(res.body.lead.claimed_at).toBe('2026-08-23 06:00:00');
    });
  });
});
