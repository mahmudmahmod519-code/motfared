/**
 * Companies of any industry: the words and optional features a company's dashboard uses (industry templates
 * plus the owner's overrides), its name and logo, through the real HTTP pipeline and the real migrations.
 */
import { bootstrap } from './harness';
import { Company } from '../../src/modules/companies/entities/company.entity';
import { Subscription, SubscriptionStatus } from '../../src/modules/subscriptions/entities/subscription.entity';
import { PRESETS } from '../../src/modules/companies/industry/industries';

describe('Company profile: industry words, features, name and logo', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const ids: Record<string, any> = {};
  const me = async (who: string) => (await h.get(who, '/auth/me')).body.company;

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    const A = await h.mkCompany('Profile A');
    const B = await h.mkCompany('Profile B');
    const X = await h.mkCompany('Profile Expired');
    await h.subscribe(A.id);
    await h.subscribe(B.id);
    await h.db.getRepository(Subscription).save({ company_id: X.id, plan_price_id: (await h.subscribe(A.id)).plan_price_id, status: SubscriptionStatus.EXPIRED, starts_at: new Date(Date.now() - 60 * 864e5), current_period_end: new Date(Date.now() - 30 * 864e5) } as any);
    Object.assign(ids, { A: A.id, B: B.id, X: X.id });
    for (const [co, t] of [[A.id, 'A'], [B.id, 'B']] as const) {
      for (const r of ['owner', 'admin', 'team_lead', 'sales']) {
        ids[`${r}_${t}`] = (await h.mkUser(r, `${r}-${t}@profile.test`, co, r)).id;
        h.tokenFor(`${r}_${t}`, ids[`${r}_${t}`]);
      }
    }
    ids.owner_X = (await h.mkUser('owner', 'owner-x@profile.test', X.id, 'owner')).id;
    h.tokenFor('owner_X', ids.owner_X);
    ids.platform = (await h.mkUser('platform', 'plat@profile.test', null, undefined, 'platform_admin')).id;
    h.tokenFor('platform', ids.platform);
  });
  afterAll(async () => { await h.app?.close(); });

  it('a company starts as a clinic: the original dashboard\'s words and every clinic feature, in /auth/me', async () => {
    const c = await me('sales_A');
    expect(c).toMatchObject({ id: ids.A, name: 'Profile A', industry: 'clinic', logo_url: null });
    expect(c.terms).toEqual(PRESETS.clinic.terms);
    expect(c.features).toEqual(PRESETS.clinic.features);
  });

  it('a platform admin has no company in /auth/me and no profile to read', async () => {
    expect((await h.get('platform', '/auth/me')).body.company).toBeNull();
    expect((await h.get('platform', '/company-profile')).status).toBe(404);
  });

  it('the industry list is public and holds every template', async () => {
    const res = await h.http().get('/api/industries');
    expect(res.status).toBe(200);
    expect(res.body.map((i: any) => i.key)).toEqual(['clinic', 'kitchens', 'real_estate', 'sales', 'general']);
    expect(res.body.find((i: any) => i.key === 'kitchens').terms.unit).toBe('فرع');
  });

  it('every member reads their own company\'s profile, with the overrides', async () => {
    for (const w of ['owner_A', 'admin_A', 'team_lead_A', 'sales_A']) {
      const res = await h.get(w, '/company-profile');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: ids.A, overrides: { terms: {}, features: {} } });
    }
  });

  it('the owner switches the industry: the words and features follow the new template', async () => {
    const res = await h.patch('owner_A', '/company-profile', { industry: 'kitchens' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ industry: 'kitchens', industry_label: PRESETS.kitchens.label });
    expect(res.body.terms).toEqual(PRESETS.kitchens.terms);
    expect(Object.values(res.body.features).some(Boolean)).toBe(false);
    expect((await me('sales_A')).terms.unit).toBe('فرع');
  });

  it('owners and admins override single words and features; null returns one to the template', async () => {
    let res = await h.patch('owner_A', '/company-profile', { terms: { unit: 'معرض', units: 'المعارض' }, features: { public_form: true } });
    expect(res.status).toBe(200);
    expect(res.body.terms).toMatchObject({ unit: 'معرض', units: 'المعارض', booking: 'معاينة' });
    expect(res.body.features.public_form).toBe(true);
    expect(res.body.overrides).toEqual({ terms: { unit: 'معرض', units: 'المعارض' }, features: { public_form: true } });

    res = await h.patch('admin_A', '/company-profile', { terms: { units: null } });
    expect(res.status).toBe(200);
    expect(res.body.terms.units).toBe('الفروع');
    expect(res.body.overrides.terms).toEqual({ unit: 'معرض' });
  });

  it('an owner\'s own words survive a change of industry', async () => {
    const res = await h.patch('owner_A', '/company-profile', { industry: 'real_estate' });
    expect(res.body.terms.unit).toBe('معرض');
    expect(res.body.terms.services).toBe(PRESETS.real_estate.terms.services);
    expect(res.body.features.public_form).toBe(true);
  });

  it('the name and logo change; only an https logo address is accepted, null removes it', async () => {
    expect((await h.patch('owner_A', '/company-profile', { name: 'مطابخ النور', logo_url: 'https://cdn.example.com/logo.png' })).body).toMatchObject({ name: 'مطابخ النور', logo_url: 'https://cdn.example.com/logo.png' });
    expect((await me('sales_A')).name).toBe('مطابخ النور');
    for (const bad of ['http://cdn.example.com/logo.png', 'javascript:alert(1)', 'not a url']) {
      expect((await h.patch('owner_A', '/company-profile', { logo_url: bad })).status).toBe(400);
    }
    expect((await h.patch('owner_A', '/company-profile', { logo_url: null })).body.logo_url).toBeNull();
    expect((await h.patch('owner_A', '/company-profile', { name: '   ' })).status).toBe(400);
  });

  it('refuses unknown industries, words and features with an Arabic reason; nothing is stored', async () => {
    const before = (await h.get('owner_A', '/company-profile')).body;
    expect((await h.patch('owner_A', '/company-profile', { industry: 'pharma' })).status).toBe(400);
    const t = await h.patch('owner_A', '/company-profile', { terms: { doctor: 'x' } });
    expect(t.status).toBe(400);
    expect(t.body).toMatchObject({ code: 'INVALID_TERMS' });
    expect(t.body.message).toMatch(/مش معروف/);
    expect((await h.patch('owner_A', '/company-profile', { terms: { unit: '' } })).status).toBe(400);
    expect((await h.patch('owner_A', '/company-profile', { terms: { unit: 'x'.repeat(41) } })).status).toBe(400);
    expect((await h.patch('owner_A', '/company-profile', { features: { payroll: true } })).body.code).toBe('INVALID_FEATURES');
    expect((await h.patch('owner_A', '/company-profile', { terms: 'clinic' })).status).toBe(400);
    expect((await h.patch('owner_A', '/company-profile', { company_id: ids.B })).status).toBe(400);
    expect((await h.get('owner_A', '/company-profile')).body).toEqual(before);
  });

  it('members without settings.manage cannot change the profile', async () => {
    for (const w of ['team_lead_A', 'sales_A']) {
      expect((await h.patch(w, '/company-profile', { terms: { unit: 'x' } })).status).toBe(403);
    }
    expect((await me('sales_A')).terms.unit).toBe('معرض');
  });

  it('one company\'s changes never reach another; nobody can name another company', async () => {
    const b = await me('owner_B');
    expect(b).toMatchObject({ id: ids.B, name: 'Profile B', industry: 'clinic' });
    expect(b.terms).toEqual(PRESETS.clinic.terms);
    await h.patch('owner_B', '/company-profile', { terms: { unit: 'بي' } });
    expect((await me('owner_A')).terms.unit).toBe('معرض');
    // the generic company endpoint does not let a member set the industry or words either
    expect((await h.patch('owner_A', `/companies/${ids.A}`, { industry: 'clinic' })).status).toBe(403);
    expect(DENIED_OR_404((await h.patch('owner_A', `/companies/${ids.B}`, { name: 'hijack' })).status)).toBe(true);
    const row = await h.db.getRepository(Company).findOneByOrFail({ id: ids.B });
    expect(row.name).toBe('Profile B');
    expect(row.terms).toEqual({ unit: 'بي' });
  });

  it('a lapsed company still reads its profile (the owner sees the read-only dashboard) but cannot change it', async () => {
    expect((await h.get('owner_X', '/company-profile')).status).toBe(200);
    expect((await me('owner_X')).industry).toBe('clinic');
    expect((await h.patch('owner_X', '/company-profile', { industry: 'sales' })).status).toBe(402);
  });
});

const DENIED_OR_404 = (s: number) => [403, 404].includes(s);
