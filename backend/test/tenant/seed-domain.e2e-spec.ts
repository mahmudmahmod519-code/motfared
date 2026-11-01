/** The demo data for the rebuilt schema: present with the demo seed, never duplicated, and usable through the API. */
import { bootstrap, PASSWORD } from './harness';
import { DomainDemoSeed } from '../../src/seed/domain-demo.seed';
import { Doctor } from '../../src/domain/core/doctor.entity';
import { Team } from '../../src/domain/core/team.entity';
import { Service } from '../../src/domain/core/service.entity';
import { Campaign } from '../../src/domain/core/campaign.entity';

describe('Demo data for the rebuilt schema', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  beforeAll(async () => {
    process.env.SEED_DEMO_DATA = 'true';
    h = await bootstrap({ reset: true, noThrottle: true });
  });
  afterAll(async () => { process.env.SEED_DEMO_DATA = 'false'; await h.app?.close(); });

  it('creates teams, clinics, campaigns and services once, and a second run changes nothing', async () => {
    const count = async () => [await h.db.getRepository(Team).count(), await h.db.getRepository(Doctor).count(), await h.db.getRepository(Campaign).count(), await h.db.getRepository(Service).count()];
    const first = await count();
    expect(first).toEqual([3, 4, 8, 5]);
    await h.app.get(DomainDemoSeed).run();
    expect(await count()).toEqual(first);
  });

  it('the demo owner sees every clinic, the demo team lead only team A\'s', async () => {
    const login = async (phone: string) => (await h.http().post('/api/auth/login').send({ phone, password: 'Password@123' })).body.access_token;
    const owner = { Authorization: `Bearer ${await login('+201111111111')}` };
    const lead = { Authorization: `Bearer ${await login('+201111111150')}` };
    const all = await h.http().get('/api/doctors').set(owner);
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(4);
    const mine = await h.http().get('/api/doctors').set(lead);
    expect(mine.body.map((d: any) => d.team.code)).toEqual(['A', 'A']);
    expect(PASSWORD).toBeTruthy();
  });
});
