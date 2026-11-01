/**
 * The web app sits in front of the API as a reverse proxy. Behind it, the client's address must come from
 * X-Forwarded-For (otherwise every user shares the proxy's address and one login rate limit), but only when the
 * deployment says a proxy is there: a header from an arbitrary client must never be believed by default.
 */
import { bootstrap } from './harness';

describe('Reverse proxy awareness', () => {
  afterEach(() => { delete process.env.TRUST_PROXY; delete process.env.THROTTLE_DISABLED; });

  it('does not trust X-Forwarded-For by default', async () => {
    const h = await bootstrap({ reset: true, noThrottle: true });
    try {
      expect(h.app.getHttpAdapter().getInstance().get('trust proxy')).toBeFalsy();
    } finally { await h.app.close(); }
  });

  it('trusts the given number of proxy hops when the deployment sets TRUST_PROXY', async () => {
    process.env.TRUST_PROXY = '1';
    const h = await bootstrap({ reset: false, noThrottle: true });
    try {
      expect(h.app.getHttpAdapter().getInstance().get('trust proxy')).toBe(1);
    } finally { await h.app.close(); }
  });

  it('ignores a TRUST_PROXY value that is not a small number of hops (no accidental trust-everything)', async () => {
    for (const bad of ['true', '*', 'loopback', '-1', '99', '']) {
      process.env.TRUST_PROXY = bad;
      const h = await bootstrap({ reset: false, noThrottle: true });
      try {
        expect([bad, !!h.app.getHttpAdapter().getInstance().get('trust proxy')]).toEqual([bad, false]);
      } finally { await h.app.close(); }
    }
  });

  it('with a trusted proxy the client address is the forwarded one, so users do not share a rate limit', async () => {
    process.env.TRUST_PROXY = '1';
    delete process.env.THROTTLE_DISABLED; // an earlier test in this process switched the limiter off
    const h = await bootstrap({ reset: false, noThrottle: false });
    try {
      const login = (ip: string) => h.http().post('/api/auth/login').set('X-Forwarded-For', ip).send({ phone: '01000000000', password: 'x'.repeat(8) });
      for (let i = 0; i < 20; i++) expect((await login('10.0.0.1')).status).toBe(401);
      expect((await login('10.0.0.1')).status).toBe(429); // the same client is limited…
      expect((await login('10.0.0.2')).status).toBe(401); // …another client behind the same proxy is not
    } finally { await h.app.close(); }
  });
});
