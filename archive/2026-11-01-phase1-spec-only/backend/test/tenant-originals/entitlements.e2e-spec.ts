/**
 * Phase 4 — authoritative subscription guard and entitlement matrix.
 * Written before the implementation. Every tenant is built in one subscription state and
 * must get exactly the access the matrix allows, from the backend alone.
 */
import { bootstrap } from './harness';
import { Company, CompanyStatus } from '../../src/modules/companies/entities/company.entity';
import { Lead } from '../../src/modules/leads/entities/lead.entity';
import { Subscription, SubscriptionStatus } from '../../src/modules/subscriptions/entities/subscription.entity';
import { Plan } from '../../src/modules/plans/entities/plan.entity';
import { PlanPrice, PriceInterval } from '../../src/modules/plan-prices/entities/plan-price.entity';
import { SubscriptionLifecycleService } from '../../src/modules/subscriptions/subscription-lifecycle.service';

const DAY = 864e5;
const at = (days: number) => new Date(Date.now() + days * DAY);

type Spec = {
  sub: { status: SubscriptionStatus; current_period_end?: Date; trial_ends_at?: Date } | null;
  company?: CompanyStatus;
  state: string;
  code?: string; // restriction code when work is blocked
  work: boolean; // may read and write operational data
  ownerRead?: boolean; // lapsed states: the company owner (CEO) keeps READ-ONLY access, everyone else is blocked (decision C-3)
  billing: boolean; // may reach billing endpoints
};
const S = SubscriptionStatus;
const CASES: Record<string, Spec> = {
  active: { sub: { status: S.ACTIVE, current_period_end: at(10) }, state: 'active', work: true, billing: true },
  trial: { sub: { status: S.TRIALING, trial_ends_at: at(5) }, state: 'trial', work: true, billing: true },
  trial_over: { sub: { status: S.TRIALING, trial_ends_at: at(-1) }, state: 'expired', code: 'SUBSCRIPTION_EXPIRED', work: false, ownerRead: true, billing: true },
  grace_active: { sub: { status: S.ACTIVE, current_period_end: at(-1) }, state: 'past_due', work: true, billing: true },
  beyond_grace_active: { sub: { status: S.ACTIVE, current_period_end: at(-10) }, state: 'expired', code: 'SUBSCRIPTION_EXPIRED', work: false, ownerRead: true, billing: true },
  grace_past_due: { sub: { status: S.PAST_DUE, current_period_end: at(-1) }, state: 'past_due', work: true, billing: true },
  beyond_grace_past_due: { sub: { status: S.PAST_DUE, current_period_end: at(-10) }, state: 'expired', code: 'SUBSCRIPTION_EXPIRED', work: false, ownerRead: true, billing: true },
  pending: { sub: { status: S.INCOMPLETE }, state: 'payment_pending', code: 'PAYMENT_PENDING', work: false, billing: true },
  failed: { sub: { status: S.UNPAID, current_period_end: at(-1) }, state: 'payment_failed', code: 'PAYMENT_FAILED', work: false, ownerRead: true, billing: true },
  cancelled: { sub: { status: S.CANCELED, current_period_end: at(10) }, state: 'cancelled', code: 'SUBSCRIPTION_CANCELLED', work: false, ownerRead: true, billing: true },
  expired: { sub: { status: S.EXPIRED, current_period_end: at(-30) }, state: 'expired', code: 'SUBSCRIPTION_EXPIRED', work: false, ownerRead: true, billing: true },
  none: { sub: null, state: 'none', code: 'SUBSCRIPTION_REQUIRED', work: false, billing: true },
  suspended: { sub: { status: S.ACTIVE, current_period_end: at(10) }, company: CompanyStatus.SUSPENDED, state: 'suspended', code: 'COMPANY_SUSPENDED', work: false, billing: false },
};

describe('Subscription guard / entitlement matrix', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  let priceId: string;
  const t: Record<string, { company: string; owner: string; agent: string; lead: string }> = {};
  let adminId: string;

  const mkTenant = async (name: string, spec: Spec) => {
    const co = await h.db.getRepository(Company).save(h.db.getRepository(Company).create({ name: `E ${name}`, status: spec.company ?? CompanyStatus.ACTIVE }));
    const owner = await h.mkUser(`CEO ${name}`, `owner-${name}@e.test`, co.id, 'owner');
    const agent = await h.mkUser(`Agent ${name}`, `agent-${name}@e.test`, co.id, 'sales');
    const lead = await h.db.getRepository(Lead).save({ company_id: co.id, name: `Lead ${name}`, source_type: 'manual' } as any);
    if (spec.sub) {
      await h.db.getRepository(Subscription).save({ company_id: co.id, plan_price_id: priceId, starts_at: new Date(), ...spec.sub } as any);
    }
    h.tokenFor(`owner-${name}`, owner.id);
    h.tokenFor(`agent-${name}`, agent.id);
    t[name] = { company: co.id, owner: owner.id, agent: agent.id, lead: lead.id };
  };

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    const plan = await h.db.getRepository(Plan).save({ name: 'P', slug: `p-${Date.now()}`, is_active: true } as any);
    priceId = (await h.db.getRepository(PlanPrice).save({ plan_id: plan.id, amount: 100, currency: 'EGP', interval: PriceInterval.MONTH, is_active: true } as any)).id;
    adminId = (await h.mkUser('Admin', 'ent-admin@t.test', null, undefined, 'platform_admin')).id;
    h.tokenFor('admin', adminId);
    for (const [name, spec] of Object.entries(CASES)) await mkTenant(name, spec);
  });
  afterAll(async () => { await h.app?.close(); });

  describe.each(Object.entries(CASES))('tenant in state: %s', (name, spec) => {
    it(`reports state "${spec.state}" on /subscriptions/status (always reachable)`, async () => {
      for (const who of ['owner', 'agent']) {
        const res = await h.get(`${who}-${name}`, '/subscriptions/status');
        expect(res.status).toBe(200);
        expect(res.body.state).toBe(spec.state);
        const read = spec.work || (who === 'owner' && !!spec.ownerRead);
        expect(res.body.allowed).toMatchObject({ read, write: spec.work, work: spec.work, billing: spec.billing });
        expect(res.body.read_only).toBe(!spec.work && read); // lets the UI show the "renew" banner
      }
    });

    it(spec.work ? 'allows reading and writing operational data' : spec.ownerRead ? 'owner: read-only; everyone else: blocked' : 'blocks reading and writing operational data', async () => {
      const blockedStatus = spec.code === 'COMPANY_SUSPENDED' ? 403 : 402;
      for (const who of ['owner', 'agent']) {
        const reads = [
          await h.get(`${who}-${name}`, '/leads'),
          await h.get(`${who}-${name}`, `/leads/${t[name].lead}`),
          await h.get(`${who}-${name}`, '/lead-contacts'),
          await h.get(`${who}-${name}`, '/dashboard/stats'),
        ];
        const mayRead = spec.work || (who === 'owner' && !!spec.ownerRead);
        if (mayRead) reads.forEach((r) => expect(r.status).toBe(200));
        else reads.forEach((r) => {
          expect(r.status).toBe(blockedStatus);
          expect(r.body.code).toBe(spec.code);
          expect(r.body.subscription_state).toBe(spec.state);
          expect(JSON.stringify(r.body)).not.toContain(t[name].lead);
        });
      }
      // writes: only a working subscription allows them, for the owner too
      const write = await h.post(`owner-${name}`, '/leads', { name: 'New', source_type: 'manual' });
      const patchLead = await h.patch(`owner-${name}`, `/leads/${t[name].lead}`, { notes: 'x' });
      const call = await h.post(`agent-${name}`, '/calls', { lead_contact_id: '00000000-0000-0000-0000-000000000000', outcome: 'answered' });
      if (spec.work) {
        expect(write.status).toBe(201);
        expect(patchLead.status).toBe(200);
        expect(call.status).not.toBe(402); // 404: the contact does not exist, but the guard let it through
        expect(call.status).not.toBe(403);
      } else {
        for (const r of [write, patchLead, call]) {
          expect(r.status).toBe(blockedStatus);
          expect(r.body.code).toBe(spec.code);
        }
        expect(await h.db.getRepository(Lead).countBy({ company_id: t[name].company })).toBe(1); // nothing was written
        if (spec.ownerRead) expect(write.body.read_only).toBe(true); // the owner is told it is a read-only state
      }
    });

    it(spec.billing ? 'keeps billing reachable for the CEO' : 'blocks billing for a suspended company', async () => {
      const list = await h.get(`owner-${name}`, '/billing/manual-requests');
      const subs = await h.get(`owner-${name}`, '/subscriptions/current');
      const submit = await h.post(`owner-${name}`, '/billing/manual-requests', { plan_price_id: priceId, reference: `E-${name}-${Date.now()}` });
      if (spec.billing) {
        expect(list.status).toBe(200);
        expect(subs.status).toBe(200);
        expect(submit.status).toBe(201);
      } else {
        for (const r of [list, subs, submit]) { expect(r.status).toBe(403); expect(r.body.code).toBe('COMPANY_SUSPENDED'); }
      }
    });

    it('exposes the entitlement on /auth/me (and login/me stay reachable)', async () => {
      const me = await h.get(`agent-${name}`, '/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.entitlement?.state).toBe(spec.state);
    });

    it('never deletes tenant data', async () => {
      expect(await h.db.getRepository(Lead).countBy({ id: t[name].lead })).toBe(1);
    });
  });

  it('allowed responses carry the state header; past_due carries the grace deadline', async () => {
    const ok = await h.get('owner-active', '/leads');
    expect(ok.headers['x-subscription-state']).toBe('active');
    const grace = await h.get('owner-grace_active', '/leads');
    expect(grace.headers['x-subscription-state']).toBe('past_due');
    expect(Date.parse(grace.headers['x-subscription-grace-until'])).toBeGreaterThan(Date.now());
  });

  it('the owner\'s read-only responses carry a header the UI can show a banner from', async () => {
    const ok = await h.get('owner-expired', '/leads');
    expect(ok.status).toBe(200);
    expect(ok.headers['x-subscription-read-only']).toBe('true');
    expect((await h.get('owner-active', '/leads')).headers['x-subscription-read-only']).toBeUndefined();
    expect((await h.get('owner-expired', '/billing/manual-requests')).status).toBe(200); // billing stays open
  });

  it('platform admin bypasses the guard for support access', async () => {
    const res = await h.get('admin', `/leads?company_id=${t.expired.company}`);
    expect(res.status).toBe(200);
  });

  it('a company with an old cancelled subscription and a new active one is active', async () => {
    await h.db.getRepository(Subscription).save({ company_id: t.expired.company, plan_price_id: priceId, status: S.CANCELED, starts_at: new Date(), current_period_end: at(-100) } as any);
    // still expired because the newest valid one is expired; now add an active one:
    const sub = await h.db.getRepository(Subscription).save({ company_id: t.expired.company, plan_price_id: priceId, status: S.ACTIVE, starts_at: new Date(), current_period_end: at(20) } as any);
    expect((await h.get('owner-expired', '/subscriptions/status')).body.state).toBe('active');
    expect((await h.get('owner-expired', '/leads')).status).toBe(200);
    await h.db.getRepository(Subscription).delete(sub.id);
    expect((await h.get('agent-expired', '/leads')).status).toBe(402); // back to expired: agents are blocked
    expect((await h.get('owner-expired', '/leads')).status).toBe(200); // the owner reads, read-only
    expect((await h.post('owner-expired', '/leads', { name: 'x', source_type: 'manual' })).status).toBe(402);
  });

  it('reactivation: a verified payment restores access on the same token, without re-login', async () => {
    expect((await h.get('owner-none', '/leads')).status).toBe(402);
    const req = await h.post('owner-none', '/billing/manual-requests', { plan_price_id: priceId, reference: `E-react-${Date.now()}` });
    expect(req.status).toBe(201);
    expect((await h.get('owner-none', '/leads')).status).toBe(402); // a claim alone grants nothing
    expect((await h.post('admin', `/billing/manual-requests/${req.body.id}/approve`, {})).status).toBe(201);
    expect((await h.get('owner-none', '/leads')).status).toBe(200);
    expect((await h.get('agent-none', '/leads')).status).toBe(200);
    expect((await h.get('owner-none', '/subscriptions/status')).body.state).toBe('active');
  });

  it('a tenant cannot see or influence another tenant\'s state', async () => {
    const res = await h.get('owner-active', `/subscriptions/status?company_id=${t.expired.company}`);
    expect(res.status === 200 ? res.body.state : 400).not.toBe('expired');
  });

  describe('lifecycle sweeper', () => {
    it('marks overdue subscriptions expired, leaves grace/valid ones, and deletes nothing', async () => {
      const subs = h.db.getRepository(Subscription);
      const lifecycle = h.app.get(SubscriptionLifecycleService, { strict: false });
      const before = await subs.count();
      const changed = await lifecycle.expireOverdue();
      expect(changed).toBeGreaterThanOrEqual(3);
      const byCompany = async (n: string) => (await subs.findOneByOrFail({ company_id: t[n].company, ...(n === 'none' ? {} : {}) } as any));
      expect((await subs.findOneByOrFail({ company_id: t.beyond_grace_active.company })).status).toBe(S.EXPIRED);
      expect((await subs.findOneByOrFail({ company_id: t.beyond_grace_past_due.company })).status).toBe(S.EXPIRED);
      expect((await subs.findOneByOrFail({ company_id: t.trial_over.company })).status).toBe(S.EXPIRED);
      expect((await subs.findOneByOrFail({ company_id: t.grace_active.company })).status).toBe(S.ACTIVE);
      expect((await subs.findOneByOrFail({ company_id: t.active.company })).status).toBe(S.ACTIVE);
      expect((await subs.findOneByOrFail({ company_id: t.cancelled.company })).status).toBe(S.CANCELED);
      expect(await subs.count()).toBe(before);
      expect(await h.app.get(SubscriptionLifecycleService, { strict: false }).expireOverdue()).toBe(0); // idempotent
      void byCompany;
    });
  });
});
