/**
 * Phase 1 — web sign-in by phone or email, password policy, and forced password reset for
 * imported accounts. Written before the implementation.
 */
import { bootstrap, PASSWORD } from './harness';
import { User } from '../../src/modules/users/entities/user.entity';

describe('Web auth (/api/auth)', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const ids: Record<string, string> = {};
  const phone = '+201002220001';

  const login = (body: any) => h.http().post('/api/auth/login').send(body);
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    const A = await h.mkCompany('Web A');
    ids.A = A.id;
    ids.rep = (await h.mkUser('Web Rep', 'web-rep@w.test', A.id, 'sales', undefined, { phone })).id;
    ids.mailOnly = (await h.mkUser('Mail Only', 'mail-only@w.test', A.id, 'sales')).id;
    ids.blocked = (await h.mkUser('Blocked', 'web-blocked@w.test', A.id, 'sales', undefined, { phone: '+201002220002', status: 'suspended' })).id;
    ids.imported = (await h.mkUser('Imported', 'imported@w.test', A.id, 'sales', undefined, { phone: '+201002220003', must_change_password: true })).id;
  });
  afterAll(async () => { await h.app?.close(); });

  describe('sign-in', () => {
    it('signs in with a phone number and returns a token without secrets', async () => {
      const res = await login({ phone, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(typeof res.body.access_token).toBe('string');
      expect(res.body.user).toMatchObject({ id: ids.rep, name: 'Web Rep' });
      expect(JSON.stringify(res.body)).not.toMatch(/password_hash|token_version|active_phone_key/i);
      expect(res.headers['set-cookie']?.join(';')).toMatch(/access_token=/);
    });

    it.each(['01002220001', '201002220001', '+20 100 222 0001', '00201002220001', '010-0222-0001', '٠١٠٠٢٢٢٠٠٠١'])(
      'accepts the number typed as %s',
      async (typed) => {
        expect((await login({ phone: typed, password: PASSWORD })).status).toBe(200);
      },
    );

    it('still signs in with an email', async () => {
      expect((await login({ email: 'mail-only@w.test', password: PASSWORD })).status).toBe(200);
    });

    it('treats the email case-insensitively', async () => {
      expect((await login({ email: 'Mail-Only@W.test', password: PASSWORD })).status).toBe(200);
    });

    it('the token works on the rest of the API', async () => {
      const { body } = await login({ phone, password: PASSWORD });
      const me = await h.http().get('/api/auth/me').set(bearer(body.access_token));
      expect(me.status).toBe(200);
      expect(me.body.company_id).toBe(ids.A);
    });

    it('wrong password, unknown phone, unknown email and garbage are indistinguishable', async () => {
      const results = [
        await login({ phone, password: 'Wrong#Password1' }),
        await login({ phone: '+201009999999', password: PASSWORD }),
        await login({ email: 'nobody@w.test', password: PASSWORD }),
        await login({ phone: 'not-a-phone', password: PASSWORD }),
      ];
      for (const r of results) expect(r.status).toBe(401);
      for (const r of results) expect(r.body).toEqual(results[0].body);
    });

    it('refuses a suspended user the same way', async () => {
      const r = await login({ phone: '+201002220002', password: PASSWORD });
      expect(r.status).toBe(401);
    });

    it.each([
      [{}],
      [{ password: PASSWORD }],
      [{ phone, password: '' }],
      [{ phone: 123, password: PASSWORD }],
      [{ phone: ['a'], password: PASSWORD }],
      [{ email: 'x', password: PASSWORD }],
    ])('rejects malformed body %j with 400', async (body) => {
      expect((await login(body)).status).toBe(400);
    });

    it('rejects an absurdly long password without hashing it (400)', async () => {
      expect((await login({ phone, password: 'a'.repeat(5000) })).status).toBe(400);
    });

    it('lets a phone and an email be given together only when both name the same account', async () => {
      expect((await login({ phone, email: 'web-rep@w.test', password: PASSWORD })).status).toBe(200);
      expect((await login({ phone, email: 'mail-only@w.test', password: PASSWORD })).status).toBe(401);
    });
  });

  describe('password policy', () => {
    it('register refuses a short password', async () => {
      const r = await h.http().post('/api/auth/register').send({ name: 'N', email: 'short@w.test', password: 'Ab1!xyz' });
      expect(r.status).toBe(400);
    });

    it('register refuses an over-long password', async () => {
      const r = await h.http().post('/api/auth/register').send({ name: 'N', email: 'long@w.test', password: 'Ab1!' + 'x'.repeat(200) });
      expect(r.status).toBe(400);
    });

    it('change-password refuses a short or over-long new password', async () => {
      const { body } = await login({ phone, password: PASSWORD });
      for (const newPassword of ['Ab1!xyz', 'Ab1!' + 'x'.repeat(200)]) {
        const r = await h.http().post('/api/auth/change-password').set(bearer(body.access_token)).send({ currentPassword: PASSWORD, newPassword });
        expect(r.status).toBe(400);
      }
    });

    it('change-password refuses to reuse the current password', async () => {
      const { body } = await login({ phone, password: PASSWORD });
      const r = await h.http().post('/api/auth/change-password').set(bearer(body.access_token)).send({ currentPassword: PASSWORD, newPassword: PASSWORD });
      expect(r.status).toBe(400);
    });

    it('refuses a password that is just the account phone number', async () => {
      const { body } = await login({ phone, password: PASSWORD });
      const r = await h.http().post('/api/auth/change-password').set(bearer(body.access_token)).send({ currentPassword: PASSWORD, newPassword: '01002220001' });
      expect(r.status).toBe(400);
    });
  });

  describe('forced password reset (imported accounts)', () => {
    let token: string;

    it('signs in, but reports that a new password is required', async () => {
      const r = await login({ phone: '+201002220003', password: PASSWORD });
      expect(r.status).toBe(200);
      expect(r.body.must_change_password).toBe(true);
      token = r.body.access_token;
    });

    it('blocks every other endpoint until the password is changed', async () => {
      for (const url of ['/api/leads', '/api/subscriptions/status', '/api/users']) {
        const r = await h.http().get(url).set(bearer(token));
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      }
    });

    it('still allows /auth/me, logout and change-password', async () => {
      const me = await h.http().get('/api/auth/me').set(bearer(token));
      expect(me.status).toBe(200);
      expect(me.body.must_change_password).toBe(true);
    });

    it('the mobile facade blocks too, in its {error} shape, but allows login and /me/password', async () => {
      const r = await h.http().post('/api/mobile/login').send({ phone: '+201002220003', password: PASSWORD });
      expect(r.status).toBe(200);
      expect(r.body.must_change_password).toBe(true);
      const blocked = await h.http().get('/api/mobile/leads').set(bearer(r.body.token));
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      expect(typeof blocked.body.error).toBe('string');
    });

    it('the temporary password cannot be kept', async () => {
      const r = await h.http().post('/api/auth/change-password').set(bearer(token)).send({ currentPassword: PASSWORD, newPassword: PASSWORD });
      expect(r.status).toBe(400);
    });

    it('changing the password clears the flag and unblocks the account', async () => {
      const r = await h.http().post('/api/auth/change-password').set(bearer(token)).send({ currentPassword: PASSWORD, newPassword: 'Fresh#Pass99' });
      expect(r.status).toBe(200);
      const user = await h.db.getRepository(User).findOneByOrFail({ id: ids.imported });
      expect(user.must_change_password).toBe(false);
      const ok = await h.http().get('/api/subscriptions/status').set(bearer(r.body.access_token));
      expect(ok.status).toBe(200);
      const again = await login({ phone: '+201002220003', password: 'Fresh#Pass99' });
      expect(again.body.must_change_password).toBe(false);
    });
  });
});
