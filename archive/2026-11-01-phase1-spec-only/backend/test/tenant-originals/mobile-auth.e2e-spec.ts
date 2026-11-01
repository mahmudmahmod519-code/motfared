/**
 * B1 — mobile authentication on /api/mobile (legacy-compatible contract) and token revocation.
 * Written before the implementation.
 */
import { bootstrap, PASSWORD } from './harness';
import { Company, CompanyStatus } from '../../src/modules/companies/entities/company.entity';
import { User, UserStatus } from '../../src/modules/users/entities/user.entity';
import { Subscription, SubscriptionStatus } from '../../src/modules/subscriptions/entities/subscription.entity';
import { Plan } from '../../src/modules/plans/entities/plan.entity';
import { PlanPrice, PriceInterval } from '../../src/modules/plan-prices/entities/plan-price.entity';

const DAY = 864e5;

describe('Mobile auth (/api/mobile)', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const ids: Record<string, string> = {};
  const phones = { rep: '+201001110001', repB: '+201001110002' };

  const login = (phone: any, password: any = PASSWORD) => h.http().post('/api/mobile/login').send({ phone, password });
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    const plan = await h.db.getRepository(Plan).save({ name: 'P', slug: `p-${Date.now()}`, is_active: true } as any);
    const price = await h.db.getRepository(PlanPrice).save({ plan_id: plan.id, amount: 100, currency: 'EGP', interval: PriceInterval.MONTH, is_active: true } as any);
    const mkCo = async (name: string, status: CompanyStatus, sub?: any) => {
      const co = await h.db.getRepository(Company).save(h.db.getRepository(Company).create({ name, status, client_label: 'Patients', call_center_label: 'Reps' } as any));
      if (sub) await h.db.getRepository(Subscription).save({ company_id: co.id, plan_price_id: price.id, starts_at: new Date(), ...sub } as any);
      return co;
    };
    const A = await mkCo('Mobile A', CompanyStatus.ACTIVE, { status: SubscriptionStatus.ACTIVE, current_period_end: new Date(Date.now() + 10 * DAY) });
    const B = await mkCo('Mobile B', CompanyStatus.ACTIVE, { status: SubscriptionStatus.ACTIVE, current_period_end: new Date(Date.now() + 10 * DAY) });
    const S = await mkCo('Mobile Suspended', CompanyStatus.SUSPENDED, { status: SubscriptionStatus.ACTIVE, current_period_end: new Date(Date.now() + 10 * DAY) });
    const X = await mkCo('Mobile Expired', CompanyStatus.ACTIVE, { status: SubscriptionStatus.EXPIRED, current_period_end: new Date(Date.now() - 30 * DAY) });
    Object.assign(ids, { A: A.id, B: B.id, S: S.id, X: X.id });
    ids.rep = (await h.mkUser('Rep A', 'rep-a@m.test', A.id, 'sales', undefined, { phone: phones.rep })).id;
    ids.repB = (await h.mkUser('Rep B', 'rep-b@m.test', B.id, 'sales', undefined, { phone: phones.repB })).id;
    ids.susp = (await h.mkUser('Susp Co', 'rep-s@m.test', S.id, 'sales', undefined, { phone: '+201001110003' })).id;
    ids.exp = (await h.mkUser('Exp Co', 'rep-x@m.test', X.id, 'sales', undefined, { phone: '+201001110004' })).id;
    ids.blocked = (await h.mkUser('Blocked', 'rep-blocked@m.test', A.id, 'sales', undefined, { phone: '+201001110005', status: UserStatus.SUSPENDED })).id;
    ids.nocompany = (await h.mkUser('No Co', 'rep-nc@m.test', null, undefined, undefined, { phone: '+201001110006' })).id;
    ids.nomember = (await h.mkUser('No Member', 'rep-nm@m.test', A.id, undefined, undefined, { phone: '+201001110007' })).id;
    ids.admin = (await h.mkUser('Platform Admin', 'rep-adm@m.test', null, undefined, 'platform_admin', { phone: '+201001110008' })).id;
    ids.owner = (await h.mkUser('CEO A', 'owner-a@m.test', A.id, 'owner', undefined, { phone: '+201001110009' })).id;
    h.tokenFor('owner', ids.owner);
  });
  afterAll(async () => { await h.app?.close(); });

  describe('POST /login', () => {
    it('returns the legacy shape plus company and entitlement', async () => {
      const res = await login(phones.rep);
      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user).toMatchObject({ name: 'Rep A', phone: phones.rep, role: 'sales' });
      expect(res.body.company).toMatchObject({ id: ids.A, name: 'Mobile A', client_label: 'Patients', call_center_label: 'Reps' });
      expect(res.body.entitlement).toMatchObject({ state: 'active', allowed: { work: true } });
      // the flag `must_change_password` is a boolean, not a secret; everything else must not mention passwords or hashes
      expect(JSON.stringify(res.body).replace('"must_change_password":false', '')).not.toMatch(/password|hash/i);
    });

    it.each(['01001110001', '201001110001', '+20 100 111 0001', '00201001110001', '010-0111-0001', '١٠٠١١١٠٠٠١'.length ? '٠١٠٠١١١٠٠٠١' : ''])(
      'accepts the number typed as %s',
      async (typed) => {
        expect((await login(typed)).status).toBe(200);
      },
    );

    it('the token works on the rest of the API', async () => {
      const { body } = await login(phones.rep);
      const me = await h.http().get('/api/auth/me').set(bearer(body.token));
      expect(me.status).toBe(200);
      expect(me.body.company_id).toBe(ids.A);
      const st = await h.http().get('/api/subscriptions/status').set(bearer(body.token));
      expect(st.body.state).toBe('active');
    });

    it('wrong password and unknown phone are indistinguishable', async () => {
      const wrong = await login(phones.rep, 'Wrong#Password1');
      const unknown = await login('+201009999999');
      const garbage = await login('not-a-phone');
      for (const r of [wrong, unknown, garbage]) {
        expect(r.status).toBe(401);
        expect(r.body.error).toBe('Invalid phone or password');
      }
      expect(wrong.body).toEqual(unknown.body);
      expect(unknown.body).toEqual(garbage.body);
    });

    it.each([[{}], [{ phone: '+201001110001' }], [{ password: PASSWORD }], [{ phone: 123, password: PASSWORD }], [{ phone: '', password: '' }]])(
      'rejects malformed body %j with 400 and a message in `error`',
      async (body) => {
        const res = await h.http().post('/api/mobile/login').send(body);
        expect(res.status).toBe(400);
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error.length).toBeGreaterThan(0);
      },
    );

    it('refuses suspended users, and users who belong to no company', async () => {
      expect((await login('+201001110005')).status).toBe(401); // suspended user
      const noCo = await login('+201001110006');
      expect(noCo.status).toBe(403);
      expect(noCo.body.code).toBe('NO_COMPANY');
      expect((await login('+201001110007')).status).toBe(403); // company set, no active membership
      expect((await login('+201001110008')).status).toBe(403); // platform admin: not a mobile account
    });

    it('lets users of a suspended or expired company sign in, so the app can explain why (D6)', async () => {
      const s = await login('+201001110003');
      expect(s.status).toBe(200);
      expect(s.body.entitlement.state).toBe('suspended');
      const x = await login('+201001110004');
      expect(x.status).toBe(200);
      expect(x.body.entitlement).toMatchObject({ state: 'expired', allowed: { work: false, billing: true } });
      expect((await h.http().get('/api/leads').set(bearer(x.body.token))).status).toBe(402);
    });

    it('never mixes companies: each rep gets their own company', async () => {
      const b = await login(phones.repB);
      expect(b.body.company.id).toBe(ids.B);
    });
  });

  describe('revocation', () => {
    it('logout kills the token on the server, and every other token of the account', async () => {
      const t1 = (await login(phones.rep)).body.token;
      const t2 = (await login(phones.rep)).body.token;
      expect((await h.http().get('/api/auth/me').set(bearer(t1))).status).toBe(200);
      const out = await h.http().post('/api/mobile/logout').set(bearer(t1)).send({});
      expect(out.status).toBe(200);
      expect(out.body.ok).toBe(true);
      for (const t of [t1, t2]) expect((await h.http().get('/api/auth/me').set(bearer(t))).status).toBe(401);
      expect((await h.http().post('/api/mobile/logout').set(bearer(t1)).send({})).status).toBe(401);
      expect((await login(phones.rep)).status).toBe(200); // signing in again works
    });

    it('does not touch other users', async () => {
      const a = (await login(phones.rep)).body.token;
      const b = (await login(phones.repB)).body.token;
      await h.http().post('/api/mobile/logout').set(bearer(a)).send({});
      expect((await h.http().get('/api/auth/me').set(bearer(b))).status).toBe(200);
    });

    it('the web logout (/api/auth/logout) revokes too', async () => {
      const t = (await login(phones.rep)).body.token;
      expect((await h.http().post('/api/auth/logout').set(bearer(t)).send({})).status).toBe(200);
      expect((await h.http().get('/api/auth/me').set(bearer(t))).status).toBe(401);
    });

    it('a token issued before revocation stays dead even after signing in again', async () => {
      const old = (await login(phones.rep)).body.token;
      await h.http().post('/api/mobile/logout').set(bearer(old)).send({});
      const fresh = (await login(phones.rep)).body.token;
      expect((await h.http().get('/api/auth/me').set(bearer(old))).status).toBe(401);
      expect((await h.http().get('/api/auth/me').set(bearer(fresh))).status).toBe(200);
    });

    it('changing the password revokes old tokens, returns a working one, and the old password stops working', async () => {
      const tok = (await login(phones.repB)).body.token;
      const wrong = await h.http().post('/api/mobile/me/password').set(bearer(tok)).send({ currentPassword: 'nope-nope-1', newPassword: 'Another#Pass123' });
      expect(wrong.status).toBe(401);
      expect(typeof wrong.body.error).toBe('string');
      const short = await h.http().post('/api/mobile/me/password').set(bearer(tok)).send({ currentPassword: PASSWORD, newPassword: 'short' });
      expect(short.status).toBe(400);
      const ok = await h.http().post('/api/mobile/me/password').set(bearer(tok)).send({ currentPassword: PASSWORD, newPassword: 'Another#Pass123' });
      expect(ok.status).toBe(200);
      expect(ok.body.ok).toBe(true);
      expect((await h.http().get('/api/auth/me').set(bearer(tok))).status).toBe(401);
      expect((await h.http().get('/api/auth/me').set(bearer(ok.body.token))).status).toBe(200);
      expect((await login(phones.repB, PASSWORD)).status).toBe(401);
      expect((await login(phones.repB, 'Another#Pass123')).status).toBe(200);
    });

    it('/api/auth/change-password also revokes old tokens and returns a fresh one', async () => {
      const t = (await login('+201001110009')).body.token; // owner
      const res = await h.http().post('/api/auth/change-password').set(bearer(t)).send({ currentPassword: PASSWORD, newPassword: 'Ceo#NewPass123' });
      expect(res.status).toBe(200);
      expect((await h.http().get('/api/auth/me').set(bearer(t))).status).toBe(401);
      expect((await h.http().get('/api/auth/me').set(bearer(res.body.access_token))).status).toBe(200);
    });

    it('an endpoint that needs a login rejects missing and garbage tokens', async () => {
      expect((await h.http().post('/api/mobile/logout').send({})).status).toBe(401);
      expect((await h.http().post('/api/mobile/logout').set(bearer('garbage')).send({})).status).toBe(401);
    });

    it('a suspended account loses an already issued token on its next request', async () => {
      const t = (await login('+201001110004')).body.token;
      await h.db.getRepository(User).update(ids.exp, { status: UserStatus.SUSPENDED });
      expect((await h.http().get('/api/auth/me').set(bearer(t))).status).toBe(401);
      await h.db.getRepository(User).update(ids.exp, { status: UserStatus.ACTIVE });
    });
  });

  describe('phone uniqueness among active users (D7)', () => {
    // the CEO's password was changed (and the old token revoked) in the revocation tests above
    beforeAll(async () => { h.tok.owner = (await login('+201001110009', 'Ceo#NewPass123')).body.token; });
    const mk = (who: string, body: any) => h.post(who, '/users', { name: 'New', email: `n-${Date.now()}-${Math.random()}@m.test`, password: PASSWORD, role: 'sales', ...body });

    it('refuses a second active user with the same phone, in any spelling, even in another company', async () => {
      const first = await mk('owner', { phone: '+201002220001' });
      expect(first.status).toBe(201);
      for (const dup of ['01002220001', '+20 100 222 0001', '201002220001']) {
        const res = await mk('owner', { phone: dup });
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/phone/i);
      }
      // another company's user already has +201001110002
      expect((await mk('owner', { phone: '01001110002' })).status).toBe(409);
    });

    it('rejects a phone that is not a recognisable number', async () => {
      expect((await mk('owner', { phone: 'call me' })).status).toBe(400);
    });

    it('refuses to move an existing user onto a taken phone', async () => {
      const u = await mk('owner', { phone: '+201002220002' });
      const res = await h.patch('owner', `/users/${u.body.id}`, { phone: '01001110001' });
      expect(res.status).toBe(409);
    });

    it('allows the same phone again once the first user is no longer active, but never two active at once', async () => {
      const first = await mk('owner', { phone: '+201002220003' });
      expect(first.status).toBe(201);
      expect((await h.patch('owner', `/users/${first.body.id}/status`, { status: 'suspended' })).status).toBe(200);
      const second = await mk('owner', { phone: '+201002220003' });
      expect(second.status).toBe(201);
      // re-activating the first one would create a duplicate, so it is refused
      expect((await h.patch('owner', `/users/${first.body.id}/status`, { status: 'active' })).status).toBe(409);
      // and login goes to the active one
      const res = await login('+201002220003');
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('New');
    });

    it('the database itself enforces it (no race can create two active users with one phone)', async () => {
      const repo = h.db.getRepository(User);
      const a = await repo.save(repo.create({ name: 'R1', email: `r1-${Date.now()}@m.test`, password_hash: 'x', phone: '+201002220004', status: UserStatus.ACTIVE } as any));
      await expect(repo.save(repo.create({ name: 'R2', email: `r2-${Date.now()}@m.test`, password_hash: 'x', phone: '01002220004', status: UserStatus.ACTIVE } as any))).rejects.toThrow(/Duplicate/i);
      expect(a.id).toBeDefined();
    });

    it('/api/auth/register refuses a taken phone too', async () => {
      const res = await h.http().post('/api/auth/register').send({ name: 'X', email: `reg-${Date.now()}@m.test`, password: PASSWORD, phone: '01001110001' });
      expect(res.status).toBe(409);
    });
  });
});
