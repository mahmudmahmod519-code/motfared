/**
 * Phase 2.1 — tenant-isolation negative tests (Company A vs Company B).
 *
 * These assert the TARGET security behaviour, so several fail on the current code
 * (findings B1–B8 in DEVELOPMENT_TRACKER.md). They must be green after Phase 2.2.
 *
 * Needs a throwaway MySQL (never the compose `saas_crm` DB — this suite writes data):
 *   docker run -d --rm --name saas-test-mysql -e MYSQL_ROOT_PASSWORD=root_pass \
 *     -e MYSQL_DATABASE=saas_test -e MYSQL_USER=saas_test -e MYSQL_PASSWORD=saas_test \
 *     -p 127.0.0.1:3307:3306 mysql:8.0
 *   npm run test:tenant
 *
 * Users are modelled realistically: a company CEO has `company_id` + a membership row
 * and NO platform_role (unlike the older e2e specs, which stored 'owner' in platform_role).
 */
process.env.DB_HOST = process.env.TEST_DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.TEST_DB_PORT || '3307';
process.env.DB_USERNAME = 'saas_test';
process.env.DB_PASSWORD = 'saas_test';
process.env.DB_DATABASE = 'saas_test';
process.env.NODE_ENV = 'test';
// the tests must not depend on the developer's .env: no demo seed unless a test asks for one
process.env.SEED_DEMO_DATA = 'false';
process.env.JWT_SECRET = 'tenant-test-secret-0123456789abcdef0123456789';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_0123456789abcdef0123456789abcdef';
process.env.PAYMOB_HMAC_SECRET = 'paymob_test_hmac_0123456789abcdef0123456789abcdef';
// Build the schema from the real migrations on a wiped database (see harness.ts for why).
process.env.DB_SYNCHRONIZE = 'false';
process.env.DB_MIGRATIONS_RUN = 'true';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { wipeDatabase } from './harness';
import { Company, CompanyStatus } from '../../src/modules/companies/entities/company.entity';
import { User, UserStatus } from '../../src/modules/users/entities/user.entity';
import { CompanyMembership } from '../../src/modules/company-memberships/entities/company-membership.entity';
import { Lead } from '../../src/modules/leads/entities/lead.entity';
import { LeadContact } from '../../src/modules/lead-contacts/entities/lead-contact.entity';
import { Call, CallOutcome } from '../../src/modules/calls/entities/call.entity';
import { Service } from '../../src/modules/services/entities/service.entity';
import { Plan } from '../../src/modules/plans/entities/plan.entity';
import { PlanPrice, PriceInterval } from '../../src/modules/plan-prices/entities/plan-price.entity';
import { Subscription, SubscriptionStatus } from '../../src/modules/subscriptions/entities/subscription.entity';
import { JwtService } from '@nestjs/jwt';
import { PlanSales } from '../../src/modules/plan-sales/entities/plan-sales.entity';
import { LeadItem } from '../../src/modules/lead-items/entities/lead-item.entity';
import { Payment, PaymentStatus } from '../../src/modules/payments/entities/payment.entity';

const PASSWORD = 'Tenant#Test1';
const DENIED = [400, 401, 403, 404];

describe('Tenant isolation (Company A vs Company B)', () => {
  let app: INestApplication;
  let db: DataSource;
  let http: () => request.SuperTest<request.Test>;

  const ids: Record<string, string> = {};
  const tok: Record<string, string> = {};

  const as = (who: string) => ({ Authorization: `Bearer ${tok[who]}` });
  const get = (who: string, url: string) => http().get(`/api${url}`).set(as(who));
  const post = (who: string, url: string, body: any = {}) => http().post(`/api${url}`).set(as(who)).send(body);
  const patch = (who: string, url: string, body: any) => http().patch(`/api${url}`).set(as(who)).send(body);
  const del = (who: string, url: string) => http().delete(`/api${url}`).set(as(who));

  async function mkUser(name: string, email: string, company_id: string | null, role?: string) {
    const users = db.getRepository(User);
    const u = await users.save(
      users.create({
        name,
        email,
        password_hash: await argon2.hash(PASSWORD),
        status: UserStatus.ACTIVE,
        company_id: company_id as any,
      }),
    );
    if (company_id && role) {
      await db.getRepository(CompanyMembership).save({ company_id, user_id: u.id, role } as any);
    }
    return u;
  }

  async function login(key: string, email: string) {
    const res = await http().post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBeLessThan(300);
    tok[key] = res.body.access_token;
  }

  beforeAll(async () => {
    await wipeDatabase();
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    db = app.get(DataSource);
    http = () => request(app.getHttpServer());

    const stamp = Date.now();
    const companies = db.getRepository(Company);
    const A = await companies.save(companies.create({ name: `Co A ${stamp}`, status: CompanyStatus.ACTIVE }));
    const B = await companies.save(companies.create({ name: `Co B ${stamp}`, status: CompanyStatus.ACTIVE }));
    ids.A = A.id;
    ids.B = B.id;

    const ceoA = await mkUser('CEO A', `owner-a-${stamp}@t.test`, A.id, 'owner');
    const ceoB = await mkUser('CEO B', `owner-b-${stamp}@t.test`, B.id, 'owner');
    const agentA = await mkUser('Agent A', `agent-a-${stamp}@t.test`, A.id, 'sales');
    const loner = await mkUser('No Company', `loner-${stamp}@t.test`, null);
    Object.assign(ids, { ceoA: ceoA.id, ceoB: ceoB.id, agentA: agentA.id, loner: loner.id });

    // Company A data + a parallel set for B (so list endpoints have foreign rows to leak).
    for (const [tag, co] of [['A', A.id], ['B', B.id]] as const) {
      const lead = await db.getRepository(Lead).save({ company_id: co, name: `Lead ${tag}`, source_type: 'manual' } as any);
      const contact = await db.getRepository(LeadContact).save({
        company_id: co, lead_id: lead.id, name: `Contact ${tag}`, phone: `+2010000000${tag === 'A' ? 1 : 2}`,
      } as any);
      const call = await db.getRepository(Call).save({
        company_id: co, lead_contact_id: contact.id, outcome: CallOutcome.ANSWERED,
        call_center_user_id: tag === 'A' ? agentA.id : ceoB.id, notes: `call ${tag}`, called_at: new Date(),
      } as any);
      const ps = await db.getRepository(PlanSales).save({ company_id: co, name: `Plan ${tag}`, created_by: tag === 'A' ? ceoA.id : ceoB.id } as any);
      const li = await db.getRepository(LeadItem).save({ lead_id: lead.id, plan_sales_id: ps.id } as any);
      const svc = await db.getRepository(Service).save({ company_id: co, name: `Svc ${tag}`, price: 10, currency: 'EGP' } as any);
      const plan = await db.getRepository(Plan).save({ name: `Plan ${tag} ${stamp}`, slug: `plan-${tag}-${stamp}`, is_active: true } as any);
      const price = await db.getRepository(PlanPrice).save({ plan_id: plan.id, amount: 100, currency: 'EGP', interval: PriceInterval.MONTH, is_active: true } as any);
      const sub = await db.getRepository(Subscription).save({
        company_id: co, plan_price_id: price.id, status: SubscriptionStatus.TRIALING, starts_at: new Date(),
        current_period_start: new Date(), current_period_end: new Date(Date.now() + 7 * 864e5),
      } as any);
      const pay = await db.getRepository(Payment).save({
        subscription_id: sub.id, provider: 'manual', amount: 100, currency: 'EGP',
        status: PaymentStatus.SUCCEEDED, idempotency_key: `idem-${tag}-${stamp}`,
      } as any);
      Object.assign(ids, {
        [`lead${tag}`]: lead.id, [`contact${tag}`]: contact.id, [`call${tag}`]: call.id,
        [`ps${tag}`]: ps.id, [`li${tag}`]: li.id, [`svc${tag}`]: svc.id, [`price${tag}`]: price.id, [`sub${tag}`]: sub.id, [`pay${tag}`]: pay.id,
      });
    }

    await login('ceoA', ceoA.email);
    await login('ceoB', ceoB.email);
    await login('agentA', agentA.email);
    await login('loner', loner.email);
  });

  afterAll(async () => {
    await app?.close();
  });

  const bodyOf = (res: request.Response) => JSON.stringify(res.body ?? {});

  // ─────────────────────────────── positive controls ───────────────────────────────
  describe('controls (own-tenant access must keep working)', () => {
    it('CEO A can read own lead by id', async () => {
      const res = await get('ceoA', `/leads/${ids.leadA}`);
      expect(res.status).toBe(200);
    });
    it('CEO A can list own leads and sees only company A rows', async () => {
      const res = await get('ceoA', '/leads');
      expect(res.status).toBe(200);
      expect(bodyOf(res)).toContain(ids.leadA);
      expect(bodyOf(res)).not.toContain(ids.leadB);
    });
    it('CEO A can create a lead (company taken from the verified token, not the body) [B4]', async () => {
      const res = await post('ceoA', '/leads', { company_id: ids.B, name: 'Created by A', source_type: 'manual' });
      expect(res.status).toBe(201);
      expect(res.body.company_id).toBe(ids.A);
    });
  });

  // ──────────────────────────── B1: user with no company ────────────────────────────
  describe('B1: self-registered user with no company sees nothing', () => {
    it.each(['/leads', '/lead-contacts', '/calls', '/services', '/subscriptions', '/plan-sales', '/payments', '/users', '/companies'])(
      'GET %s leaks no tenant rows',
      async (url) => {
        const res = await get('loner', url);
        const text = bodyOf(res);
        for (const k of ['leadA', 'leadB', 'contactA', 'contactB', 'callA', 'callB', 'svcA', 'svcB', 'subA', 'subB', 'payA', 'payB', 'ceoA', 'ceoB']) {
          expect(text).not.toContain(ids[k]);
        }
      },
    );
  });

  // ───────────────────── B3: cross-tenant read / write by id (IDOR) ─────────────────────
  describe('B3: Company B cannot read Company A rows by id', () => {
    it.each([
      ['lead', 'leads', 'leadA'],
      ['lead contact', 'lead-contacts', 'contactA'],
      ['call', 'calls', 'callA'],
      ['service', 'services', 'svcA'],
      ['subscription', 'subscriptions', 'subA'],
      ['payment', 'payments', 'payA'],
      ['company', 'companies', 'A'],
      ['user', 'users', 'ceoA'],
    ])('GET %s by id', async (_n, path, key) => {
      const res = await get('ceoB', `/${path}/${ids[key]}`);
      expect(DENIED).toContain(res.status);
    });

    it('B list endpoints never contain A rows', async () => {
      for (const url of ['/leads', '/lead-contacts', '/calls', '/services', '/subscriptions', '/payments', '/companies', '/users', `/users?company_id=${ids.A}`, `/payments?subscription_id=${ids.subA}`]) {
        const res = await get('ceoB', url);
        const text = bodyOf(res);
        for (const k of ['leadA', 'contactA', 'callA', 'svcA', 'subA', 'payA', 'ceoA', 'agentA']) {
          expect({ url, leaked: text.includes(ids[k]) ? k : null }).toEqual({ url, leaked: null });
        }
      }
    });
  });

  describe('B3: Company B cannot modify Company A rows', () => {
    it('PATCH/DELETE lead', async () => {
      expect(DENIED).toContain((await patch('ceoB', `/leads/${ids.leadA}`, { name: 'pwned' })).status);
      expect(DENIED).toContain((await del('ceoB', `/leads/${ids.leadA}`)).status);
      const row = await db.getRepository(Lead).findOneBy({ id: ids.leadA });
      expect(row?.name).toBe('Lead A');
    });
    it('PATCH lead contact', async () => {
      expect(DENIED).toContain((await patch('ceoB', `/lead-contacts/${ids.contactA}`, { name: 'pwned' })).status);
      expect((await db.getRepository(LeadContact).findOneBy({ id: ids.contactA }))?.name).toBe('Contact A');
    });
    it('PATCH and DELETE call', async () => {
      expect(DENIED).toContain((await patch('ceoB', `/calls/${ids.callA}`, { notes: 'pwned' })).status);
      expect(DENIED).toContain((await del('ceoB', `/calls/${ids.callA}`)).status);
      expect((await db.getRepository(Call).findOneBy({ id: ids.callA }))?.notes).toBe('call A');
    });
    it('PATCH service', async () => {
      expect(DENIED).toContain((await patch('ceoB', `/services/${ids.svcA}`, { name: 'pwned' })).status);
      expect((await db.getRepository(Service).findOneBy({ id: ids.svcA }))?.name).toBe('Svc A');
    });
    it('PATCH company', async () => {
      expect(DENIED).toContain((await patch('ceoB', `/companies/${ids.A}`, { name: 'pwned' })).status);
      expect((await db.getRepository(Company).findOneBy({ id: ids.A }))?.name).toMatch(/^Co A /);
    });
    it('cancel subscription', async () => {
      expect(DENIED).toContain((await post('ceoB', `/subscriptions/${ids.subA}/cancel`, {})).status);
      expect((await db.getRepository(Subscription).findOneBy({ id: ids.subA }))?.status).toBe(SubscriptionStatus.TRIALING);
    });
  });

  describe('B3/B4c: cross-tenant foreign keys on create', () => {
    it("CEO A cannot log a call against Company B's contact", async () => {
      const res = await post('ceoA', '/calls', { company_id: ids.A, lead_contact_id: ids.contactB, outcome: 'answered' });
      expect(DENIED).toContain(res.status);
      expect((await db.getRepository(LeadContact).findOneBy({ id: ids.contactB }))?.status).toBe('new');
    });
    it("CEO A cannot attach a contact to Company B's lead", async () => {
      const res = await post('ceoA', '/lead-contacts', { company_id: ids.A, lead_id: ids.leadB, name: 'x', phone: '+201000000009' });
      expect(DENIED).toContain(res.status);
    });
  });

  // ───────────────────────── B2: user privilege escalation / takeover ─────────────────────────
  describe('B2: users cannot escalate privileges or take over accounts', () => {
    it('self-registered user cannot make themselves platform_admin', async () => {
      const res = await patch('loner', `/users/${ids.loner}`, { platform_role: 'platform_admin' });
      expect(DENIED).toContain(res.status);
      expect((await db.getRepository(User).findOneBy({ id: ids.loner }))?.platform_role).toBeFalsy();
    });
    it('self-registered user cannot move themselves into Company A', async () => {
      const res = await patch('loner', `/users/${ids.loner}`, { company_id: ids.A });
      expect(DENIED).toContain(res.status);
      expect((await db.getRepository(User).findOneBy({ id: ids.loner }))?.company_id).toBeFalsy();
    });
    it("CEO B cannot reset Company A CEO's password or change their data", async () => {
      const before = (await db.getRepository(User).findOneBy({ id: ids.ceoA }))!.password_hash;
      const res = await patch('ceoB', `/users/${ids.ceoA}`, { password: 'Attacker#12345', name: 'pwned' });
      expect(DENIED).toContain(res.status);
      const after = await db.getRepository(User).findOneBy({ id: ids.ceoA });
      expect(after?.password_hash).toBe(before);
      expect(after?.name).toBe('CEO A');
    });
    it("CEO B cannot edit Company A users' profile fields either", async () => {
      expect(DENIED).toContain((await patch('ceoB', `/users/${ids.agentA}`, { name: 'pwned' })).status);
      expect((await db.getRepository(User).findOneBy({ id: ids.agentA }))?.name).not.toBe('pwned');
    });
    it("CEO B cannot suspend Company A's users", async () => {
      expect(DENIED).toContain((await patch('ceoB', `/users/${ids.agentA}/status`, { status: 'suspended' })).status);
      expect((await db.getRepository(User).findOneBy({ id: ids.agentA }))?.status).toBe(UserStatus.ACTIVE);
    });
    it('a call-center agent cannot create users or edit the company', async () => {
      expect(DENIED).toContain((await post('agentA', '/users', { name: 'z', email: `z-${Date.now()}@t.test`, password: PASSWORD })).status);
      expect(DENIED).toContain((await patch('agentA', `/companies/${ids.A}`, { name: 'agent-edit' })).status);
    });
  });


  // ───────────── plan / lead-item / assignment isolation and cross-tenant foreign keys ─────────────
  describe('B3: plans, lead items and assignments', () => {
    it('Company B cannot read or change Company A plan sales / lead items', async () => {
      for (const url of [`/plan-sales/${ids.psA}`, `/lead-items/${ids.liA}`]) {
        expect(DENIED).toContain((await get('ceoB', url)).status);
      }
      expect(DENIED).toContain((await patch('ceoB', `/plan-sales/${ids.psA}`, { name: 'pwned' })).status);
      expect(DENIED).toContain((await del('ceoB', `/lead-items/${ids.liA}`)).status);
      expect((await db.getRepository(PlanSales).findOneBy({ id: ids.psA }))?.name).toBe('Plan A');
      expect(await db.getRepository(LeadItem).countBy({ id: ids.liA })).toBe(1);
    });
    it("CEO A cannot attach their lead to Company B's plan", async () => {
      const res = await post('ceoA', '/lead-items', { lead_id: ids.leadA, plan_sales_id: ids.psB });
      expect(DENIED).toContain(res.status);
    });
    it("CEO A cannot assign Company B's user to a Company A lead item", async () => {
      const res = await post('ceoA', '/lead-item-call-centers', { lead_item_id: ids.liA, user_id: ids.ceoB });
      expect(DENIED).toContain(res.status);
    });
    it('CEO A can assign own agent to own lead item (control)', async () => {
      const res = await post('ceoA', '/lead-item-call-centers', { lead_item_id: ids.liA, user_id: ids.agentA });
      expect(res.status).toBe(201);
    });
  });

  describe('B2/B4: roles come from the database, never from the token or the request', () => {
    it('forged token claims (platform_admin / other company) grant nothing', async () => {
      const jwt = app.get(JwtService, { strict: false });
      const forged = jwt.sign({ sub: ids.loner, email: 'x', company_id: ids.A, platform_role: 'platform_admin', role: 'owner' });
      for (const url of ['/leads', '/companies', '/users', '/subscriptions']) {
        const res = await http().get(`/api${url}`).set({ Authorization: `Bearer ${forged}` });
        expect(bodyOf(res)).not.toContain(ids.leadA);
        expect(bodyOf(res)).not.toContain(ids.A);
        expect([200, 403]).toContain(res.status);
      }
      expect(DENIED).toContain((await http().patch(`/api/companies/${ids.A}`).set({ Authorization: `Bearer ${forged}` }).send({ name: 'pwned' })).status);
    });
    it('CEO can create members of their own company only, with no platform role', async () => {
      const email = `member-${Date.now()}@t.test`;
      const res = await post('ceoA', '/users', { name: 'Member', email, password: PASSWORD, company_id: ids.B, role: 'sales' });
      expect(res.status).toBe(201);
      expect(res.body.company_id).toBe(ids.A);
      const m = await db.getRepository(CompanyMembership).findOneBy({ user_id: res.body.id });
      expect(m?.company_id).toBe(ids.A);
      expect(m?.role).toBe('sales');
      expect(DENIED).toContain((await post('ceoA', '/users', { name: 'X', email: `x-${Date.now()}@t.test`, password: PASSWORD, platform_role: 'platform_admin' })).status);
      expect(DENIED).toContain((await post('ceoA', '/users', { name: 'X', email: `y-${Date.now()}@t.test`, password: PASSWORD, role: 'owner' })).status);
    });
    it('CEO cannot grant the owner role through memberships', async () => {
      const res = await post('ceoA', '/company-memberships', { company_id: ids.A, user_id: ids.agentA, role: 'owner' });
      expect(DENIED).toContain(res.status);
    });
    it('user can edit own profile but not role, company, status or password', async () => {
      expect((await patch('agentA', `/users/${ids.agentA}`, { name: 'Agent A2' })).status).toBe(200);
      for (const body of [{ platform_role: 'platform_admin' }, { company_id: ids.B }, { status: 'active' }, { password: 'Another#Pass123' }]) {
        expect(DENIED).toContain((await patch('agentA', `/users/${ids.agentA}`, body)).status);
      }
    });
    it('suspending a user or removing their membership takes effect on the next request', async () => {
      const email = `temp-${Date.now()}@t.test`;
      const created = await post('ceoA', '/users', { name: 'Temp', email, password: PASSWORD, role: 'sales' });
      await login('temp', email);
      expect((await get('temp', '/leads')).status).toBe(200);
      await db.getRepository(CompanyMembership).delete({ user_id: created.body.id });
      expect(DENIED).toContain((await get('temp', '/leads')).status);
      await db.getRepository(User).update(created.body.id, { status: UserStatus.SUSPENDED });
      expect((await get('temp', '/leads')).status).toBe(401);
    });
    it('a call-center agent sees only their own calls', async () => {
      const own = await post('agentA', '/calls', { company_id: ids.B, lead_contact_id: ids.contactA, outcome: 'answered' });
      expect(own.status).toBe(201);
      expect(own.body.company_id).toBe(ids.A);
      expect(own.body.call_center_user_id).toBe(ids.agentA);
      const list = await get('agentA', '/calls');
      expect(bodyOf(list)).toContain(own.body.id);
      expect(DENIED).toContain((await get('agentA', `/calls/${ids.callB}`)).status);
    });
  });

  // ───────────────────── B6: subscription self-activation ─────────────────────
  describe('B6: tenants cannot grant themselves paid access', () => {
    it('CEO cannot PATCH own subscription to active / extend the period', async () => {
      const res = await patch('ceoA', `/subscriptions/${ids.subA}`, {
        status: 'active', current_period_end: new Date(Date.now() + 3650 * 864e5).toISOString(),
      });
      expect(DENIED).toContain(res.status);
      expect((await db.getRepository(Subscription).findOneBy({ id: ids.subA }))?.status).toBe(SubscriptionStatus.TRIALING);
    });
    it('CEO cannot create an already-active subscription', async () => {
      const res = await post('ceoA', '/subscriptions', {
        company_id: ids.A, plan_price_id: ids.priceA, status: 'active',
        current_period_end: new Date(Date.now() + 3650 * 864e5).toISOString(),
      });
      const active = await db.getRepository(Subscription).count({ where: { company_id: ids.A, status: SubscriptionStatus.ACTIVE } });
      expect({ status: res.status, active }).toEqual({ status: expect.any(Number), active: 0 });
      expect(DENIED).toContain(res.status);
    });
  });

  // ───────────────────── B5: unsigned webhooks ─────────────────────
  describe('B5: webhooks without a valid signature are rejected', () => {
    it('unsigned Stripe event is rejected and changes nothing', async () => {
      const res = await http().post('/api/webhooks/stripe').send({
        id: `evt_unsigned_${Date.now()}`, type: 'invoice.payment_succeeded',
        data: { object: { subscription: 'sub_x', customer: 'cus_x' } },
      });
      expect([400, 401, 403]).toContain(res.status);
    });
    it('unsigned Paymob callback is rejected', async () => {
      const res = await http().post('/api/webhooks/paymob').send({ obj: { id: 1, success: true } });
      expect([400, 401, 403]).toContain(res.status);
    });
    it('webhook event log is not readable by a tenant CEO', async () => {
      expect(DENIED).toContain((await get('ceoA', '/webhooks/events')).status);
    });
  });

  // ───────────────────── B8: default credentials ─────────────────────
  describe('B8: no default platform admin outside explicit seeding', () => {
    it('admin@platform.com / Admin@123 is rejected', async () => {
      const res = await http().post('/api/auth/login').send({ email: 'admin@platform.com', password: 'Admin@123' });
      expect(res.status).toBe(401);
    });
  });
});
