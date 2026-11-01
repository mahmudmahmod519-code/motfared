/**
 * S2 — teams, doctors (clinics), campaigns and services on the rebuilt schema, through the real HTTP pipeline.
 * Written before the implementation.
 */
import { bootstrap } from './harness';
import { Doctor } from '../../src/domain/core/doctor.entity';
import { Campaign } from '../../src/domain/core/campaign.entity';
import { Lead } from '../../src/domain/core/lead.entity';
import { CompanyMembership } from '../../src/modules/company-memberships/entities/company-membership.entity';
import { Company, CompanyStatus } from '../../src/modules/companies/entities/company.entity';
import { Subscription, SubscriptionStatus } from '../../src/modules/subscriptions/entities/subscription.entity';

describe('Clinics: teams, doctors, campaigns, services', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const ids: Record<string, any> = {};
  const put = (who: string, url: string, body: any) => h.http().put(`/api${url}`).set(h.as(who)).send(body);

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    const A = await h.mkCompany('Clinics A');
    const B = await h.mkCompany('Clinics B');
    const X = await h.mkCompany('Clinics Expired');
    await h.subscribe(A.id);
    await h.subscribe(B.id);
    await h.db.getRepository(Subscription).save({ company_id: X.id, plan_price_id: (await h.subscribe(A.id)).plan_price_id, status: SubscriptionStatus.EXPIRED, starts_at: new Date(Date.now() - 60 * 864e5), current_period_end: new Date(Date.now() - 30 * 864e5) } as any);
    Object.assign(ids, { A: A.id, B: B.id, X: X.id });
    for (const [co, t] of [[A.id, 'A'], [B.id, 'B']] as const) {
      for (const r of ['owner', 'admin', 'team_lead', 'sales']) {
        ids[`${r}_${t}`] = (await h.mkUser(r, `${r}-${t}@cl.test`, co, r)).id;
        h.tokenFor(`${r}_${t}`, ids[`${r}_${t}`]);
      }
    }
    ids.owner_X = (await h.mkUser('owner', 'owner-x@cl.test', X.id, 'owner')).id;
    h.tokenFor('owner_X', ids.owner_X);
    ids.platform = (await h.mkUser('platform', 'plat@cl.test', null, undefined, 'platform_admin')).id;
    h.tokenFor('platform', ids.platform);
  });
  afterAll(async () => { await h.app?.close(); });

  describe('teams', () => {
    it('are created by those who may change settings, with a code unique within the company', async () => {
      const a = await h.post('owner_A', '/teams', { name: 'الفريق أ', code: 'A' });
      expect(a.status).toBe(201);
      expect(a.body).toMatchObject({ name: 'الفريق أ', code: 'A' });
      expect(typeof a.body.id).toBe('number');
      ids.teamA1 = a.body.id;
      ids.teamA2 = (await h.post('owner_A', '/teams', { name: 'الفريق ب', code: 'B' })).body.id;
      expect((await h.post('owner_A', '/teams', { name: 'again', code: 'A' })).status).toBe(409);
      ids.teamB1 = (await h.post('owner_B', '/teams', { name: 'Team', code: 'A' })).body.id; // same code, another company
      expect(ids.teamB1).toBeGreaterThan(0);
    });
    it('are listed in code order for anyone who opens the dashboard, only for their own company', async () => {
      const res = await h.get('team_lead_A', '/teams');
      expect(res.status).toBe(200);
      expect(res.body.map((t: any) => t.code)).toEqual(['A', 'B']);
      expect(JSON.stringify((await h.get('owner_B', '/teams')).body)).not.toContain(`"id":${ids.teamA1}`);
    });
    it('can be renamed; refused to those without settings.manage; invalid input is a 400', async () => {
      expect((await h.patch('owner_A', `/teams/${ids.teamA1}`, { name: 'الفريق الأول' })).body.name).toBe('الفريق الأول');
      for (const w of ['admin_A', 'team_lead_A', 'sales_A']) {
        // admin holds settings.manage by default; team lead and sales do not
        const r = await h.post(w, '/teams', { name: 'x', code: `Z${w.length}` });
        expect(w === 'admin_A' ? [201] : [403]).toContain(r.status);
      }
      for (const body of [{}, { name: '', code: 'C' }, { name: 'x', code: '' }, { name: 'x', code: 'c'.repeat(21) }, { name: 'x', code: 'C', extra: 1 }]) {
        expect((await h.post('owner_A', '/teams', body)).status).toBe(400);
      }
    });
    it("another company's team cannot be read or changed", async () => {
      expect((await h.patch('owner_B', `/teams/${ids.teamA1}`, { name: 'pwned' })).status).toBe(404);
    });
  });

  describe('doctors', () => {
    it('are created with the original\'s fields, defaulting to active, in the caller\'s own company', async () => {
      const res = await h.post('owner_A', '/doctors', {
        name: 'د. كريم نعيم', team_id: ids.teamA1, city: 'القاهرة', phone: '01012345678', whatsapp: '01112345678',
        address: 'شارع التحرير', maps_url: 'https://maps.example/x', hours: 'السبت-الخميس 4-10', facebook_url: 'https://fb.example/dr', instagram_url: 'https://ig.example/dr', notes: 'ملاحظة',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'د. كريم نعيم', team_id: ids.teamA1, city: 'القاهرة', active: true, slug: null, company_id: ids.A });
      expect(typeof res.body.id).toBe('number');
      ids.docA1 = res.body.id;
      ids.docA2 = (await h.post('owner_A', '/doctors', { name: 'د. منى جمال', team_id: ids.teamA2 })).body.id;
      ids.docA3 = (await h.post('owner_A', '/doctors', { name: 'د. بدون فريق' })).body.id;
      ids.docB1 = (await h.post('owner_B', '/doctors', { name: 'Dr B' })).body.id;
    });

    it('a body that names another company is ignored: the doctor lands in the caller\'s company', async () => {
      const r = await h.post('owner_A', '/doctors', { name: 'spoof', company_id: ids.B });
      expect([400, 201]).toContain(r.status);
      if (r.status === 201) expect(r.body.company_id).toBe(ids.A);
    });

    it('listing shows team, campaign count and status; the second company never appears', async () => {
      const res = await h.get('owner_A', '/doctors');
      expect(res.status).toBe(200);
      const names = res.body.map((d: any) => d.name);
      expect(names).toEqual(expect.arrayContaining(['د. كريم نعيم', 'د. منى جمال', 'د. بدون فريق']));
      expect(names).not.toContain('Dr B');
      const first = res.body.find((d: any) => d.id === ids.docA1);
      expect(first).toMatchObject({ team: { id: ids.teamA1, code: 'A' }, campaigns_count: 0, active: true });
    });

    it('creating needs doctors.manage (admin and owner yes; team lead and sales no)', async () => {
      for (const [w, ok] of [['admin_A', true], ['team_lead_A', false], ['sales_A', false]] as const) {
        const r = await h.post(w, '/doctors', { name: `by ${w}` });
        expect([w, r.status]).toEqual([w, ok ? 201 : 403]);
      }
    });
    it('a role that sees every team but holds no doctors.manage can read and cannot change anything', async () => {
      await h.post('owner_A', '/roles', { key: 'clinic_viewer', name: 'مشاهد', permissions: ['dashboard.view', 'scope.all_teams'] });
      const viewer = (await h.mkUser('Viewer', 'viewer-A@cl.test', ids.A, 'clinic_viewer')).id;
      h.tokenFor('viewer_A', viewer);
      expect((await h.get('viewer_A', '/doctors')).status).toBe(200);
      expect((await h.post('viewer_A', '/doctors', { name: 'x' })).status).toBe(403);
      expect((await h.patch('viewer_A', `/doctors/${ids.docA1}`, { city: 'x' })).status).toBe(403);
      expect((await h.post('viewer_A', `/doctors/${ids.docA1}/campaigns`, { name: 'x' })).status).toBe(403);
      expect((await h.post('viewer_A', '/teams', { name: 'x', code: 'V' })).status).toBe(403);
    });
    it('reading needs the dashboard (a rep without dashboard.view is refused)', async () => {
      expect((await h.get('sales_A', '/doctors')).status).toBe(403);
      expect((await h.get('sales_A', `/doctors/${ids.docA1}`)).status).toBe(403);
    });
    it('platform admins are not company members: they cannot use these routes', async () => {
      expect((await h.get('platform', '/doctors')).status).toBe(403);
    });

    it('a doctor can only be placed in a team of the same company', async () => {
      expect((await h.post('owner_A', '/doctors', { name: 'x', team_id: ids.teamB1 })).status).toBe(400);
      expect((await h.patch('owner_A', `/doctors/${ids.docA1}`, { team_id: ids.teamB1 })).status).toBe(400);
      expect((await h.post('owner_A', '/doctors', { name: 'x', team_id: 99999999 })).status).toBe(400);
    });

    it("another company's doctor is invisible and untouchable", async () => {
      expect((await h.get('owner_B', `/doctors/${ids.docA1}`)).status).toBe(404);
      expect((await h.patch('owner_B', `/doctors/${ids.docA1}`, { name: 'pwned' })).status).toBe(404);
      expect((await h.post('owner_B', `/doctors/${ids.docA1}/campaigns`, { name: 'x' })).status).toBe(404);
      expect((await h.db.getRepository(Doctor).findOneByOrFail({ id: ids.docA1 })).name).toBe('د. كريم نعيم');
    });

    it('is edited in place and deactivated rather than deleted', async () => {
      const r = await h.patch('owner_A', `/doctors/${ids.docA3}`, { city: 'الجيزة', active: false });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ city: 'الجيزة', active: false });
      expect((await h.get('owner_A', '/doctors?active=true')).body.map((d: any) => d.id)).not.toContain(ids.docA3);
      expect((await h.get('owner_A', '/doctors?active=false')).body.map((d: any) => d.id)).toEqual([ids.docA3]);
      expect((await h.del('owner_A', `/doctors/${ids.docA3}`)).status).toBe(404); // there is no delete route
    });

    it.each([
      [{}], [{ name: '' }], [{ name: 'x'.repeat(256) }], [{ name: 'x', phone: 'p'.repeat(51) }], [{ name: 'x', surprise: true }],
      [{ name: 'x', team_id: 'abc' }], [{ name: 'x', active: 'yes' }],
    ])('rejects invalid input %j with 400', async (body) => {
      expect((await h.post('owner_A', '/doctors', body)).status).toBe(400);
    });
  });

  describe("a doctor's public address (slug)", () => {
    it('is tidied, stored, and unique across ALL companies (it is a URL)', async () => {
      const r = await h.patch('owner_A', `/doctors/${ids.docA1}`, { slug: 'Karim Naim' });
      expect(r.status).toBe(200);
      expect(r.body.slug).toBe('karim-naim');
      const clash = await h.patch('owner_B', `/doctors/${ids.docB1}`, { slug: 'karim-naim' });
      expect(clash.status).toBe(409);
      expect(clash.body.code).toBe('SLUG_TAKEN');
      expect((await h.db.getRepository(Doctor).findOneByOrFail({ id: ids.docB1 })).slug).toBeNull();
    });
    it('is refused with the original\'s reasons, in Arabic', async () => {
      for (const [slug, re] of [['كريم', /إنجليزي/], ['ab', /قصير/], ['123', /أرقام/], ['admin', /محجوز/], ['bad slug!', /حروف/]] as const) {
        const r = await h.patch('owner_A', `/doctors/${ids.docA2}`, { slug });
        expect([slug, r.status]).toEqual([slug, 400]);
        expect(r.body.code).toBe('SLUG_INVALID');
        expect(String(r.body.message)).toMatch(re);
      }
    });
    it('can be cleared, and keeping your own slug on save is not a clash', async () => {
      expect((await h.patch('owner_A', `/doctors/${ids.docA1}`, { slug: 'karim-naim', city: 'x' })).status).toBe(200);
      expect((await h.patch('owner_A', `/doctors/${ids.docA1}`, { slug: null })).body.slug).toBeNull();
      expect((await h.patch('owner_A', `/doctors/${ids.docA1}`, { slug: 'karim-naim' })).status).toBe(200);
    });
    it('a suggestion is offered from the name, the way the original spells it', async () => {
      const r = await h.get('owner_A', '/doctors/suggest-slug?name=' + encodeURIComponent('د. كريم نعيم'));
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ slug: 'karim-naim' });
      expect((await h.get('sales_A', '/doctors/suggest-slug?name=x')).status).toBe(403);
    });
  });

  describe('campaigns', () => {
    it('belong to a doctor, are created and renamed by doctors.manage, and counted on the doctor', async () => {
      const c = await h.post('owner_A', `/doctors/${ids.docA1}/campaigns`, { name: 'حملة سبتمبر' });
      expect(c.status).toBe(201);
      expect(c.body).toMatchObject({ name: 'حملة سبتمبر', doctor_id: ids.docA1, company_id: ids.A });
      ids.campA1 = c.body.id;
      ids.campA2 = (await h.post('owner_A', `/doctors/${ids.docA1}/campaigns`, { name: 'حملة أكتوبر' })).body.id;
      const list = await h.get('admin_A', `/doctors/${ids.docA1}/campaigns`); // admin: every team
      expect(list.status).toBe(200);
      expect(list.body.map((x: any) => x.name)).toEqual(['حملة سبتمبر', 'حملة أكتوبر']);
      expect((await h.get('owner_A', `/doctors/${ids.docA1}`)).body.campaigns.length).toBe(2);
      expect((await h.get('owner_A', '/doctors')).body.find((d: any) => d.id === ids.docA1).campaigns_count).toBe(2);
      expect((await h.patch('owner_A', `/campaigns/${ids.campA1}`, { name: 'حملة سبتمبر ٢' })).body.name).toBe('حملة سبتمبر ٢');
    });
    it('refuse the wrong people and the wrong input', async () => {
      expect((await h.post('team_lead_A', `/doctors/${ids.docA1}/campaigns`, { name: 'x' })).status).toBe(403);
      expect((await h.patch('team_lead_A', `/campaigns/${ids.campA1}`, { name: 'x' })).status).toBe(403);
      for (const body of [{}, { name: '  ' }, { name: 'x'.repeat(256) }, { name: 'x', doctor_id: 5 }]) {
        expect((await h.post('owner_A', `/doctors/${ids.docA1}/campaigns`, body)).status).toBe(400);
      }
    });
    it("another company's campaign cannot be touched", async () => {
      expect((await h.patch('owner_B', `/campaigns/${ids.campA1}`, { name: 'pwned' })).status).toBe(404);
      expect((await h.get('owner_B', `/doctors/${ids.docA1}/campaigns`)).status).toBe(404);
      expect((await h.db.getRepository(Campaign).findOneByOrFail({ id: ids.campA1 })).name).toBe('حملة سبتمبر ٢');
    });
  });

  describe('team scoping: a manager of one team sees only that team', () => {
    beforeAll(async () => {
      // the team lead may now manage clinics, but has no scope.all_teams
      await put('owner_A', '/roles/team_lead', { permissions: ['leads.work', 'dashboard.view', 'reports.view', 'leads.manage', 'accounts.view', 'doctors.manage'] });
      await h.db.getRepository(CompanyMembership).update({ user_id: ids.team_lead_A }, { team_id: ids.teamA1 } as any);
    });
    it('lists, reads and edits only doctors of their own team', async () => {
      const list = await h.get('team_lead_A', '/doctors');
      expect(list.body.map((d: any) => d.id)).toEqual([ids.docA1]);
      expect((await h.get('team_lead_A', `/doctors/${ids.docA2}`)).status).toBe(404); // other team
      expect((await h.get('team_lead_A', `/doctors/${ids.docA3}`)).status).toBe(404); // no team
      expect((await h.patch('team_lead_A', `/doctors/${ids.docA2}`, { city: 'x' })).status).toBe(404);
      expect((await h.get('team_lead_A', `/doctors/${ids.docA2}/campaigns`)).status).toBe(404);
      expect((await h.patch('team_lead_A', `/doctors/${ids.docA1}`, { city: 'مدينة نصر' })).status).toBe(200);
    });
    it("cannot rename or add campaigns of another team's clinic", async () => {
      const other = (await h.post('owner_A', `/doctors/${ids.docA2}/campaigns`, { name: 'حملة فريق ب' })).body.id;
      expect((await h.patch('team_lead_A', `/campaigns/${other}`, { name: 'pwned' })).status).toBe(404);
      expect((await h.post('team_lead_A', `/doctors/${ids.docA2}/campaigns`, { name: 'x' })).status).toBe(404);
      expect((await h.db.getRepository(Campaign).findOneByOrFail({ id: other })).name).toBe('حملة فريق ب');
      expect((await h.patch('team_lead_A', `/campaigns/${ids.campA1}`, { name: 'حملة فريقي' })).status).toBe(200);
    });
    it('creates doctors only inside their own team', async () => {
      const own = await h.post('team_lead_A', '/doctors', { name: 'new in my team', team_id: ids.teamA1 });
      expect(own.status).toBe(201);
      const unset = await h.post('team_lead_A', '/doctors', { name: 'team omitted' });
      expect(unset.status).toBe(201);
      expect(unset.body.team_id).toBe(ids.teamA1); // defaults to theirs
      expect((await h.post('team_lead_A', '/doctors', { name: 'elsewhere', team_id: ids.teamA2 })).status).toBe(403);
      expect((await h.patch('team_lead_A', `/doctors/${ids.docA1}`, { team_id: ids.teamA2 })).status).toBe(403); // cannot move it out
    });
    it('a manager with no team sees nothing; one with scope.all_teams (admin, owner) sees everything', async () => {
      await h.db.getRepository(CompanyMembership).update({ user_id: ids.team_lead_A }, { team_id: null } as any);
      expect((await h.get('team_lead_A', '/doctors')).body).toEqual([]);
      await h.db.getRepository(CompanyMembership).update({ user_id: ids.team_lead_A }, { team_id: ids.teamA1 } as any);
      expect((await h.get('admin_A', '/doctors?active=true')).body.length).toBeGreaterThanOrEqual(3);
    });
    it('the team shows up on the session so the web can tell', async () => {
      expect((await h.get('team_lead_A', '/auth/me')).body.team_id).toBe(ids.teamA1);
    });
  });

  describe('services', () => {
    it('are a per-company list of names, anyone may read them, services.manage may change them', async () => {
      const s = await h.post('owner_A', '/services', { name: 'تقويم أسنان' });
      expect(s.status).toBe(201);
      expect(s.body).toMatchObject({ name: 'تقويم أسنان', active: true, company_id: ids.A });
      expect(typeof s.body.id).toBe('number');
      ids.svcA1 = s.body.id;
      ids.svcA2 = (await h.post('admin_A', '/services', { name: 'حشو' })).body.id;
      expect((await h.post('owner_B', '/services', { name: 'تقويم أسنان' })).status).toBe(201); // same name, another company
      expect((await h.post('owner_A', '/services', { name: 'تقويم أسنان' })).status).toBe(409);
      for (const w of ['owner_A', 'admin_A', 'team_lead_A', 'sales_A']) {
        const list = await h.get(w, '/services');
        expect(list.status).toBe(200);
        expect(list.body.map((x: any) => x.name)).toEqual(['تقويم أسنان', 'حشو'].sort((a, b) => a.localeCompare(b, 'ar')));
      }
      for (const w of ['team_lead_A', 'sales_A']) expect((await h.post(w, '/services', { name: 'x' })).status).toBe(403);
    });
    it('are renamed, switched off and on, and refuse a clashing name', async () => {
      expect((await h.patch('owner_A', `/services/${ids.svcA2}`, { active: false })).body.active).toBe(false);
      expect((await h.patch('owner_A', `/services/${ids.svcA2}`, { name: 'حشو عصب', active: true })).body).toMatchObject({ name: 'حشو عصب', active: true });
      expect((await h.patch('owner_A', `/services/${ids.svcA2}`, { name: 'تقويم أسنان' })).status).toBe(409);
    });
    it("cannot cross companies, and unknown or invalid input is a 400", async () => {
      expect((await h.get('owner_B', `/services/${ids.svcA1}`)).status).toBe(404);
      expect((await h.patch('owner_B', `/services/${ids.svcA1}`, { name: 'pwned' })).status).toBe(404);
      expect((await h.del('owner_B', `/services/${ids.svcA1}`)).status).toBe(404);
      for (const body of [{}, { name: '' }, { name: 'x', price: 5 }, { name: 'x', active: 'no' }]) {
        expect((await h.post('owner_A', '/services', body)).status).toBe(400);
      }
    });
    it('can be deleted while unused, but not once a lead points at it (deactivate instead)', async () => {
      const unused = (await h.post('owner_A', '/services', { name: 'مؤقتة' })).body.id;
      expect((await h.del('owner_A', `/services/${unused}`)).status).toBe(200);
      const camp = ids.campA1;
      await h.db.getRepository(Lead).insert({ company_id: ids.A, name: 'L', phone: '01099990000', campaign_id: camp, service_id: ids.svcA1 } as any);
      const r = await h.del('owner_A', `/services/${ids.svcA1}`);
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('SERVICE_IN_USE');
    });
    it('a platform admin may still manage a named company\'s services (support)', async () => {
      const r = await h.post('platform', '/services', { name: 'من الدعم', company_id: ids.B });
      expect(r.status).toBe(201);
      expect(r.body.company_id).toBe(ids.B);
    });
  });

  describe('subscription state', () => {
    it('a lapsed company\'s owner can read clinics but not change them', async () => {
      await h.db.getRepository(Company).update(ids.X, { status: CompanyStatus.ACTIVE } as any);
      expect((await h.get('owner_X', '/doctors')).status).toBe(200);
      expect((await h.get('owner_X', '/teams')).status).toBe(200);
      expect([402, 403]).toContain((await h.post('owner_X', '/doctors', { name: 'x' })).status);
      expect([402, 403]).toContain((await h.post('owner_X', '/teams', { name: 'x', code: 'Q' })).status);
      expect([402, 403]).toContain((await h.post('owner_X', '/services', { name: 'x' })).status);
    });
  });
});
