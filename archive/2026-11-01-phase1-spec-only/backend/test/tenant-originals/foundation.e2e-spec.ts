/**
 * B2.1 — foundation schema for the mobile port: constraints, integer mobile ids, per-company
 * phone uniqueness, doctor links capped at three, call results, company settings.
 * Written before the entities/migration exist.
 */
import { bootstrap } from './harness';
import { TenantService } from '../../src/common/tenant/tenant.service';
import { Lead } from '../../src/modules/leads/entities/lead.entity';
import { LeadContact } from '../../src/modules/lead-contacts/entities/lead-contact.entity';
import { Service } from '../../src/modules/services/entities/service.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Doctor } from '../../src/modules/doctors/entities/doctor.entity';
import { Subscription, SubscriptionStatus } from '../../src/modules/subscriptions/entities/subscription.entity';
import { Plan } from '../../src/modules/plans/entities/plan.entity';
import { PlanPrice, PriceInterval } from '../../src/modules/plan-prices/entities/plan-price.entity';
import { UserDoctor } from '../../src/modules/doctors/entities/user-doctor.entity';
import { CallResult } from '../../src/modules/call-results/entities/call-result.entity';
import { CompanySetting } from '../../src/modules/company-settings/entities/company-setting.entity';

describe('B2.1 foundation schema', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const ids: Record<string, string> = {};
  let seq = 0;
  const n = () => `${Date.now()}${++seq}`;
  // repo.create() makes a real entity instance, so the phone_key listener runs as it does in the services.
  const contact = (company_id: string, lead_id: string, phone: string, extra: any = {}) =>
    h.db.getRepository(LeadContact).save(h.db.getRepository(LeadContact).create({ company_id, lead_id, name: `C ${n()}`, phone, ...extra } as any)) as Promise<LeadContact>;
  const doctor = (company_id: string, name = `Dr ${n()}`, extra: any = {}) =>
    h.db.getRepository(Doctor).save({ company_id, name, ...extra } as any) as Promise<Doctor>;

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    const A = await h.mkCompany('Found A');
    const B = await h.mkCompany('Found B');
    ids.A = A.id; ids.B = B.id;
    ids.rep = (await h.mkUser('Rep A', 'f-rep-a@t.test', A.id, 'sales')).id;
    ids.repB = (await h.mkUser('Rep B', 'f-rep-b@t.test', B.id, 'sales')).id;
    // an active subscription for company A, so the API-level tests are not stopped by the subscription guard
    const plan = await h.db.getRepository(Plan).save({ name: 'P', slug: `p-${Date.now()}`, is_active: true } as any);
    const price = await h.db.getRepository(PlanPrice).save({ plan_id: plan.id, amount: 1, currency: 'EGP', interval: PriceInterval.MONTH, is_active: true } as any);
    await h.db.getRepository(Subscription).save({ company_id: A.id, plan_price_id: price.id, status: SubscriptionStatus.ACTIVE, starts_at: new Date(), current_period_end: new Date(Date.now() + 30 * 864e5) } as any);
    ids.leadA = (await h.db.getRepository(Lead).save({ company_id: A.id, name: 'Source A', source_type: 'manual' } as any)).id;
    ids.leadB = (await h.db.getRepository(Lead).save({ company_id: B.id, name: 'Source B', source_type: 'manual' } as any)).id;
  });
  afterAll(async () => { await h.app?.close(); });

  describe('integer mobile ids (D8)', () => {
    it('contacts, doctors and services get distinct integer mobile_ids from the database', async () => {
      const c1 = await contact(ids.A, ids.leadA, '+201005550001');
      const c2 = await contact(ids.B, ids.leadB, '+201005550002');
      const d1 = await doctor(ids.A);
      const d2 = await doctor(ids.B);
      const s1 = await h.db.getRepository(Service).save({ company_id: ids.A, name: 'S1', price: 1, currency: 'EGP' } as any);
      const s2 = await h.db.getRepository(Service).save({ company_id: ids.B, name: 'S2', price: 1, currency: 'EGP' } as any);
      const read = async (repo: any, id: string) => (await repo.findOneByOrFail({ id })).mobile_id;
      const cs = [await read(h.db.getRepository(LeadContact), c1.id), await read(h.db.getRepository(LeadContact), c2.id)];
      const ds = [await read(h.db.getRepository(Doctor), d1.id), await read(h.db.getRepository(Doctor), d2.id)];
      const ss = [await read(h.db.getRepository(Service), s1.id), await read(h.db.getRepository(Service), s2.id)];
      for (const pair of [cs, ds, ss]) {
        pair.forEach((v) => expect(Number.isInteger(v)).toBe(true));
        expect(pair[1]).toBeGreaterThan(pair[0]);
      }
    });

    it('mobile_id cannot be set or changed through the ORM', async () => {
      const repo = h.db.getRepository(LeadContact);
      const c = await contact(ids.A, ids.leadA, '+201005550003', { mobile_id: 999999 });
      const row = await repo.findOneByOrFail({ id: c.id });
      expect(row.mobile_id).not.toBe(999999);
      const before = row.mobile_id;
      await repo.update(c.id, { mobile_id: 5 } as any).catch(() => undefined);
      expect((await repo.findOneByOrFail({ id: c.id })).mobile_id).toBe(before);
    });
  });

  describe('lead_contacts: new fields and per-company phone uniqueness (D12)', () => {
    it('has the mobile fields with sane defaults', async () => {
      const c = await contact(ids.A, ids.leadA, '+201005551001');
      const row = await h.db.getRepository(LeadContact).findOneByOrFail({ id: c.id });
      expect(row).toMatchObject({ whatsapp_count: 0, work_status: 'new', source: null, notes: null, alt_name: null, alt_phone: null, assigned_user_id: null, claimed_at: null });
    });

    it('stores a canonical phone_key whatever the spelling', async () => {
      const a = await contact(ids.A, ids.leadA, '+20 100 555 2001');
      expect((await h.db.getRepository(LeadContact).findOneByOrFail({ id: a.id })).phone_key).toBe('01005552001');
    });

    it('the database refuses a second contact with the same canonical phone in one company', async () => {
      await contact(ids.A, ids.leadA, '01005553001');
      for (const dup of ['+201005553001', '201005553001', '010-0555-3001']) {
        await expect(contact(ids.A, ids.leadA, dup)).rejects.toThrow(/Duplicate/i);
      }
    });

    it('the same phone may exist in another company', async () => {
      await contact(ids.A, ids.leadA, '01005554001');
      await expect(contact(ids.B, ids.leadB, '01005554001')).resolves.toBeDefined();
    });

    it('numbers that are not recognisable are not constrained', async () => {
      await contact(ids.A, ids.leadA, 'ext 12');
      await expect(contact(ids.A, ids.leadA, 'ext 12')).resolves.toBeDefined();
    });

    it('API: a duplicate create is a 409, not a 500', async () => {
      h.tokenFor('ceoA', (await h.mkUser('CEO A', 'f-owner-a@t.test', ids.A, 'owner')).id);
      const ok = await h.post('ceoA', '/lead-contacts', { lead_id: ids.leadA, name: 'X', phone: '01005555001' });
      expect(ok.status).toBe(201);
      const dup = await h.post('ceoA', '/lead-contacts', { lead_id: ids.leadA, name: 'Y', phone: '+201005555001' });
      expect(dup.status).toBe(409);
      expect(dup.body.message).toMatch(/phone/i);
    });

    it('API: sheet import skips rows whose phone already exists instead of failing the batch', async () => {
      await contact(ids.A, ids.leadA, '01005556001');
      const res = await h.post('ceoA', `/google-sheets/import/${ids.leadA}`, {
        rows: [
          { name: 'Dup', phone: '+201005556001', external_row_id: 'r1' },
          { name: 'New', phone: '01005556002', external_row_id: 'r2' },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(2);
      expect(res.body.find((r: any) => r.external_row_id === 'r1')?.skipped_duplicate).toBe(true);
      expect(res.body.find((r: any) => r.external_row_id === 'r2')?.skipped_duplicate).toBeFalsy();
      expect(await h.db.getRepository(LeadContact).countBy({ company_id: ids.A, phone_key: '01005556002' })).toBe(1);
    });
  });

  describe('doctors and rep links (capped at three)', () => {
    it('a doctor belongs to one company; assertOwned refuses another company', async () => {
      const d = await doctor(ids.A);
      const tenant = h.app.get(TenantService);
      await expect(tenant.assertOwned('doctor', d.id, ids.A)).resolves.toBeUndefined();
      await expect(tenant.assertOwned('doctor', d.id, ids.B)).rejects.toThrow(/not found/i);
    });

    it('a rep can have primary, secondary and tertiary doctors, and nothing beyond', async () => {
      const links = h.db.getRepository(UserDoctor);
      const [d1, d2, d3, d4] = [await doctor(ids.A), await doctor(ids.A), await doctor(ids.A), await doctor(ids.A)];
      const link = (doctor_id: string, rank: string) => links.save({ company_id: ids.A, user_id: ids.rep, doctor_id, rank } as any);
      await link(d1.id, 'primary');
      await link(d2.id, 'secondary');
      await link(d3.id, 'tertiary');
      await expect(link(d4.id, 'quaternary')).rejects.toThrow(); // not one of the three slots
      await expect(link(d4.id, '4')).rejects.toThrow();
      await expect(link(d4.id, 'secondary')).rejects.toThrow(/Duplicate/i); // slot already taken for this rep
      await expect(link(d1.id, 'tertiary')).rejects.toThrow(/Duplicate/i); // same doctor twice
      expect(await links.countBy({ user_id: ids.rep })).toBe(3);
    });

    it('links disappear with their doctor or user (data stays consistent)', async () => {
      const d = await doctor(ids.B);
      const links = h.db.getRepository(UserDoctor);
      await links.save({ company_id: ids.B, user_id: ids.repB, doctor_id: d.id, rank: 'primary' } as any);
      await h.db.getRepository(Doctor).delete(d.id);
      expect(await links.countBy({ doctor_id: d.id })).toBe(0);
    });

    it('a lead source can point at a doctor, and survives the doctor being removed', async () => {
      const d = await doctor(ids.A);
      const src = await h.db.getRepository(Lead).save({ company_id: ids.A, name: 'Campaign', source_type: 'manual', doctor_id: d.id } as any);
      expect((await h.db.getRepository(Lead).findOneByOrFail({ id: src.id })).doctor_id).toBe(d.id);
      await h.db.getRepository(Doctor).delete(d.id);
      expect((await h.db.getRepository(Lead).findOneByOrFail({ id: src.id })).doctor_id).toBeNull();
    });
  });

  describe('call_results', () => {
    it('records an outcome per contact and user, defaulting to kind "lead"', async () => {
      const c = await contact(ids.A, ids.leadA, '+201005557001');
      const r = await h.db.getRepository(CallResult).save({ company_id: ids.A, lead_contact_id: c.id, user_id: ids.rep, outcome: 'no_answer' } as any);
      const row = await h.db.getRepository(CallResult).findOneByOrFail({ id: r.id });
      expect(row).toMatchObject({ company_id: ids.A, outcome: 'no_answer', kind: 'lead' });
      expect(row.created_at).toBeInstanceOf(Date);
    });

    it('is removed with its contact (legacy deleted results with the lead)', async () => {
      const c = await contact(ids.A, ids.leadA, '+201005557002');
      await h.db.getRepository(CallResult).save({ company_id: ids.A, lead_contact_id: c.id, user_id: ids.rep, outcome: 'interested' } as any);
      await h.db.getRepository(LeadContact).delete(c.id);
      expect(await h.db.getRepository(CallResult).countBy({ lead_contact_id: c.id })).toBe(0);
    });

    it('requires an existing contact and user', async () => {
      const bad = h.db.getRepository(CallResult).save({ company_id: ids.A, lead_contact_id: '00000000-0000-0000-0000-000000000000', user_id: ids.rep, outcome: 'no_answer' } as any);
      await expect(bad).rejects.toThrow();
    });
  });

  describe('company_settings', () => {
    it('is a per-company key/value store; a key is unique within a company only', async () => {
      const repo = h.db.getRepository(CompanySetting);
      await repo.save({ company_id: ids.A, key: 'weekly_off_days', value: '[5]' } as any);
      await expect(repo.save({ company_id: ids.A, key: 'weekly_off_days', value: '[4]' } as any)).rejects.toThrow(/Duplicate/i);
      await expect(repo.save({ company_id: ids.B, key: 'weekly_off_days', value: '[4]' } as any)).resolves.toBeDefined();
      expect((await repo.findOneByOrFail({ company_id: ids.A, key: 'weekly_off_days' })).value).toBe('[5]');
    });
  });

  it('teams: users, doctors and contacts can carry an optional team_id', async () => {
    const d = await doctor(ids.A, 'Team doc', { team_id: 7 });
    const c = await contact(ids.A, ids.leadA, '+201005558001', { team_id: 7 });
    await h.db.getRepository(User).update(ids.rep, { team_id: 7 } as any);
    expect((await h.db.getRepository(Doctor).findOneByOrFail({ id: d.id })).team_id).toBe(7);
    expect((await h.db.getRepository(LeadContact).findOneByOrFail({ id: c.id })).team_id).toBe(7);
    expect((await h.db.getRepository(User).findOneByOrFail({ id: ids.rep })).team_id).toBe(7);
  });
});
