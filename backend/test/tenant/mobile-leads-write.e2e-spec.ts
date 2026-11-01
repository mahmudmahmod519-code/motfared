/**
 * B2.4 — mobile lead writes and messages (/api/mobile): POST/PATCH/DELETE /leads, reopen,
 * written-contact, whatsapp-sent, doctor-messages, message/:key. Written before the implementation.
 * Messages and status codes follow the legacy backend (Egyptian Arabic in `error`).
 */
import { bootstrap } from './harness';
import { Company } from '../../src/modules/companies/entities/company.entity';
import { Lead } from '../../src/modules/leads/entities/lead.entity';
import { LeadContact } from '../../src/modules/lead-contacts/entities/lead-contact.entity';
import { Doctor } from '../../src/modules/doctors/entities/doctor.entity';
import { UserDoctor } from '../../src/modules/doctors/entities/user-doctor.entity';
import { DoctorMessage } from '../../src/modules/doctors/entities/doctor-message.entity';
import { MessageTemplate } from '../../src/modules/message-templates/entities/message-template.entity';
import { CallResult } from '../../src/modules/call-results/entities/call-result.entity';
import { User, UserStatus } from '../../src/modules/users/entities/user.entity';
import { Subscription, SubscriptionStatus } from '../../src/modules/subscriptions/entities/subscription.entity';
import { Plan } from '../../src/modules/plans/entities/plan.entity';
import { PlanPrice, PriceInterval } from '../../src/modules/plan-prices/entities/plan-price.entity';

const DAY = 864e5;
const STAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const hours = (h: number) => new Date(Date.now() - h * 3600e3);
const days = (d: number) => new Date(Date.now() - d * DAY);

describe('Mobile lead writes and messages (/api/mobile)', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const ids: Record<string, any> = {};
  const mob: Record<string, number> = {};
  let seq = 0;
  let phoneSeq = 1000;
  const newPhone = () => `0101${String(++phoneSeq).padStart(7, '0')}`;
  const repo = (e: any) => h.db.getRepository(e);
  const api = {
    get: (who: string, url: string) => h.get(who, `/mobile${url}`),
    post: (who: string, url: string, body: any = {}) => h.post(who, `/mobile${url}`, body),
    patch: (who: string, url: string, body: any) => h.patch(who, `/mobile${url}`, body),
    del: (who: string, url: string) => h.del(who, `/mobile${url}`),
  };
  const row = (label: string) => repo(LeadContact).findOneByOrFail({ id: ids[label] });

  const mk = async (label: string, company: string, source: string, extra: any = {}) => {
    const c = (await repo(LeadContact).save(
      repo(LeadContact).create({ company_id: company, lead_id: source, name: label, phone: newPhone(), work_status: 'new', ...extra }) as any,
    )) as any;
    ids[label] = c.id;
    mob[label] = (await repo(LeadContact).findOneByOrFail({ id: c.id })).mobile_id;
    return c;
  };

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    const plan = await repo(Plan).save({ name: 'P', slug: `p-${Date.now()}`, is_active: true } as any);
    const price = await repo(PlanPrice).save({ plan_id: plan.id, amount: 1, currency: 'EGP', interval: PriceInterval.MONTH, is_active: true } as any);
    const mkCo = async (name: string, sub: any) => {
      const co = (await repo(Company).save(repo(Company).create({ name, status: 'active' } as any))) as any;
      await repo(Subscription).save({ company_id: co.id, plan_price_id: price.id, starts_at: new Date(), ...sub } as any);
      return co;
    };
    const ok = { status: SubscriptionStatus.ACTIVE, current_period_end: new Date(Date.now() + 30 * DAY) };
    const A = await mkCo('MW A', ok);
    const B = await mkCo('MW B', ok);
    const X = await mkCo('MW Expired', { status: SubscriptionStatus.EXPIRED, current_period_end: days(40) });
    Object.assign(ids, { A: A.id, B: B.id, X: X.id });
    for (const [k, co] of [['repA1', A], ['repA2', A], ['repB', B], ['repX', X]] as const) {
      ids[k] = (await h.mkUser(k, `mw-${k}@t.test`, co.id, 'sales')).id;
      h.tokenFor(k, ids[k]);
    }
    ids.docA1 = (await repo(Doctor).save({ company_id: A.id, name: 'د. أحمد' } as any)).id;
    ids.docA2 = (await repo(Doctor).save({ company_id: A.id, name: 'د. سارة' } as any)).id;
    ids.docA3 = (await repo(Doctor).save({ company_id: A.id, name: 'د. غير مربوط' } as any)).id;
    ids.docB = (await repo(Doctor).save({ company_id: B.id, name: 'Dr B' } as any)).id;
    for (const k of ['docA1', 'docA2', 'docA3', 'docB']) mob[k] = (await repo(Doctor).findOneByOrFail({ id: ids[k] })).mobile_id;
    await repo(UserDoctor).save({ company_id: A.id, user_id: ids.repA1, doctor_id: ids.docA1, rank: 'primary' } as any);
    await repo(UserDoctor).save({ company_id: A.id, user_id: ids.repA1, doctor_id: ids.docA2, rank: 'secondary' } as any);
    await repo(UserDoctor).save({ company_id: B.id, user_id: ids.repB, doctor_id: ids.docB, rank: 'primary' } as any);

    ids.srcA1 = (await repo(Lead).save({ company_id: A.id, name: 'Campaign A1', source_type: 'manual', doctor_id: ids.docA1 } as any)).id;
    ids.srcB = (await repo(Lead).save({ company_id: B.id, name: 'Campaign B', source_type: 'manual', doctor_id: ids.docB } as any)).id;
    ids.srcNone = (await repo(Lead).save({ company_id: A.id, name: 'No doctor', source_type: 'manual' } as any)).id;

    // doctor messages: docA1 has two (out of order on purpose), docA2 one, docB one
    await repo(DoctorMessage).save({ company_id: A.id, doctor_id: ids.docA1, title: 'ثانياً', body: 'ثاني {{lead_name}}', sort_order: 2 } as any);
    await repo(DoctorMessage).save({ company_id: A.id, doctor_id: ids.docA1, title: 'ترحيب', body: 'أهلاً {{lead_name}} مع {{doctor_name}} يوم {{scheduled_weekday}} {{scheduled_date}} الساعة {{scheduled_time}}{{booking_notes}}', sort_order: 1 } as any);
    await repo(DoctorMessage).save({ company_id: A.id, doctor_id: ids.docA2, title: 'Other doctor', body: 'should not appear', sort_order: 1 } as any);
    await repo(DoctorMessage).save({ company_id: B.id, doctor_id: ids.docB, title: 'B secret', body: 'B secret body', sort_order: 1 } as any);
    await repo(MessageTemplate).save({ company_id: A.id, key: 'whatsapp_followup', label: 'متابعة A', body: 'تخصيص A: {{lead_name}}' } as any);
    await repo(MessageTemplate).save({ company_id: B.id, key: 'whatsapp_followup', label: 'B', body: 'تخصيص B السري' } as any);

    const claimed = hours(2);
    const mine = { assigned_user_id: ids.repA1, claimed_at: claimed, first_claimed_at: claimed };
    await mk('own', A.id, ids.srcA1, { ...mine, whatsapp_phone: '01512345678', source: 'rep', notes: 'n' });
    await mk('imported', A.id, ids.srcA1, { ...mine, source: null });
    await mk('terminal', A.id, ids.srcA1, { assigned_user_id: ids.repA1, claimed_at: days(10), first_claimed_at: days(12), work_status: 'not_interested', whatsapp_sent_at: days(9) });
    await mk('nodoctor', A.id, ids.srcNone, { ...mine });
    await mk('colleague', A.id, ids.srcA1, { assigned_user_id: ids.repA2, claimed_at: claimed, first_claimed_at: claimed });
    await mk('orphan', A.id, ids.srcA1, { assigned_user_id: null, claimed_at: null, work_status: 'not_interested' }); // in the pool, nobody holds it
    await mk('touchedOwned', A.id, ids.srcA1, { assigned_user_id: ids.repA2, claimed_at: days(5), first_claimed_at: days(5), work_status: 'unreachable' });
    await mk('touchedFree', A.id, ids.srcA1, { assigned_user_id: null, claimed_at: null, first_claimed_at: days(5), work_status: 'unreachable' });
    await mk('stranger', A.id, ids.srcA1, { assigned_user_id: ids.repA2, claimed_at: days(5), first_claimed_at: days(5), work_status: 'unreachable' });
    await mk('otherCo', B.id, ids.srcB, { assigned_user_id: ids.repB, claimed_at: claimed, first_claimed_at: claimed, name: 'B Secret Lead' });
    await mk('delRep', A.id, ids.srcA1, { ...mine, source: 'rep' });
    await mk('delImported', A.id, ids.srcA1, { ...mine, source: null });
    const touch = (label: string, user: string, at = days(5)) =>
      repo(CallResult).save(repo(CallResult).create({ company_id: A.id, lead_contact_id: ids[label], user_id: ids[user], outcome: 'no_answer', kind: 'lead', created_at: at } as any));
    await touch('touchedOwned', 'repA1');
    await touch('touchedFree', 'repA1');
    await touch('delRep', 'repA1', hours(1));
    // 'stranger' is held by repA2 and repA1 never touched it
  });
  afterAll(async () => { await h.app?.close(); });

  // ───────────────────────────── POST /leads ─────────────────────────────
  describe('POST /leads', () => {
    it('creates a lead held and claimed by the rep, under their primary doctor', async () => {
      const phone = newPhone();
      const res = await api.post('repA1', '/leads', { name: '  عميل جديد  ', phone, notes: 'ملاحظة' });
      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.lead).toMatchObject({ name: 'عميل جديد', phone, status: 'new', doctorId: mob.docA1, doctorName: 'د. أحمد', notes: 'ملاحظة', source: 'rep', nextAction: { action: 'call' } });
      expect(res.body.lead.claimed_at).toMatch(STAMP);
      const saved = await repo(LeadContact).findOneByOrFail({ mobile_id: res.body.lead.id });
      expect(saved).toMatchObject({ company_id: ids.A, assigned_user_id: ids.repA1, source: 'rep', work_status: 'new' });
      expect(saved.claimed_at).toBeInstanceOf(Date);
      expect(saved.first_claimed_at).toBeInstanceOf(Date);
      expect(saved.lead_id).toBe(ids.srcA1); // the doctor's existing campaign
    });

    it('creates the doctor\'s manual source when the doctor has none, and uses a chosen linked doctor', async () => {
      const res = await api.post('repA1', '/leads', { name: 'عند الدكتورة', phone: newPhone(), doctorId: mob.docA2 });
      expect(res.status).toBe(201);
      expect(res.body.lead.doctorId).toBe(mob.docA2);
      const src = await repo(Lead).findOneByOrFail({ doctor_id: ids.docA2 });
      expect(src).toMatchObject({ company_id: ids.A, name: 'إدخال يدوي', source_type: 'manual' });
    });

    it('canonicalises numbers typed into free text and the WhatsApp line', async () => {
      const res = await api.post('repA1', '/leads', { name: 'نص', phone: 'ده رقمي 010 3555 6677', whatsappPhone: '+20 112 345 6789' });
      expect(res.status).toBe(201);
      expect(res.body.lead).toMatchObject({ phone: '01035556677', whatsappPhone: '01123456789' });
    });

    it.each([
      [{ phone: '01011112222' }, 400, 'اكتب اسم العميل'],
      [{ name: 'x', phone: 'abc' }, 400, 'رقم التليفون مش صحيح - مصري زي 01xxxxxxxxx، أو أي دولة عربية بكود الدولة زي +966…'],
      [{ name: 'x', phone: '01011112222', whatsappPhone: '123' }, 400, 'رقم الواتساب مش صحيح'],
    ])('rejects %j with the legacy message', async (body, status, error) => {
      const res = await api.post('repA1', '/leads', body);
      expect(res.status).toBe(status);
      expect(res.body.error).toBe(error);
    });

    it('requires a linked doctor, and refuses one the rep is not linked to (including another company\'s)', async () => {
      const msg = 'لازم تكون مربوط بدكتور الأول عشان تضيف ليد - اطلب من الأدمن يربطك';
      const noDoctors = await api.post('repA2', '/leads', { name: 'x', phone: newPhone() });
      expect(noDoctors.status).toBe(400);
      expect(noDoctors.body.error).toBe(msg);
      for (const doctorId of [mob.docA3, mob.docB, 987654]) {
        const res = await api.post('repA1', '/leads', { name: 'x', phone: newPhone(), doctorId });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe(msg);
      }
    });

    it('a duplicate number is a 409 that says whose it is, whichever number column or spelling matched', async () => {
      const own = await row('own');
      const mineDup = await api.post('repA1', '/leads', { name: 'dup', phone: own.phone.replace(/^0/, '+20') });
      expect(mineDup.status).toBe(409);
      expect(mineDup.body).toMatchObject({ error: 'الرقم ده موجود عندك أصلاً باسم "own"', leadId: mob.own, leadName: 'own', mine: true, ownerName: 'repA1' });

      const colleague = await row('colleague');
      const theirs = await api.post('repA1', '/leads', { name: 'dup', phone: colleague.phone });
      expect(theirs.status).toBe(409);
      expect(theirs.body).toMatchObject({ error: 'الرقم ده موجود كليد باسم "colleague" مع repA2', mine: false, ownerName: 'repA2', leadId: mob.colleague });

      const byWhatsapp = await api.post('repA1', '/leads', { name: 'dup', phone: '01512345678' }); // own lead's WhatsApp line
      expect(byWhatsapp.status).toBe(409);
      expect(byWhatsapp.body.leadId).toBe(mob.own);

      const free = await row('orphan');
      const pool = await api.post('repA1', '/leads', { name: 'dup', phone: free.phone });
      expect(pool.status).toBe(409);
      expect(pool.body).toMatchObject({ error: 'الرقم ده موجود كليد باسم "orphan" ومش مع حد دلوقتي - تقدر ترجّعه من سجل الليدز', mine: false, ownerName: null });
    });

    it('the same number in another company is not a duplicate', async () => {
      const other = await row('otherCo');
      const res = await api.post('repA1', '/leads', { name: 'same number elsewhere', phone: other.phone });
      expect(res.status).toBe(201);
      expect(JSON.stringify(res.body)).not.toContain('B Secret Lead');
    });

    it('concurrent creation of one number makes exactly one lead', async () => {
      const phone = newPhone();
      const rs = await Promise.all([1, 2, 3, 4].map(() => api.post('repA1', '/leads', { name: 'race', phone })));
      expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
      expect(rs.filter((r) => r.status === 409)).toHaveLength(3);
      expect(await repo(LeadContact).countBy({ company_id: ids.A, phone_key: phone })).toBe(1);
    });

    it('clamps notes to 2000 characters', async () => {
      const res = await api.post('repA1', '/leads', { name: 'long', phone: newPhone(), notes: 'ن'.repeat(2500) });
      expect(res.body.lead.notes).toHaveLength(2000);
    });

    it('ignores nothing it should refuse: unknown fields are rejected, so status/owner/company cannot be set', async () => {
      for (const extra of [{ status: 'booked' }, { assigned_user_id: ids.repA2 }, { company_id: ids.B }, { source: 'upload' }]) {
        const res = await api.post('repA1', '/leads', { name: 'x', phone: newPhone(), ...extra });
        expect(res.status).toBe(400);
        expect(typeof res.body.error).toBe('string');
      }
    });
  });

  // ───────────────────────────── PATCH /leads/:id ─────────────────────────────
  describe('PATCH /leads/:id', () => {
    it('edits name, second contact and notes; a new second number is recorded as client contact', async () => {
      const res = await api.patch('repA1', `/leads/${mob.imported}`, { name: 'اسم جديد', altName: 'أخوها', altPhone: '01099887766', notes: 'ملاحظات جديدة' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.lead).toMatchObject({ name: 'اسم جديد', altName: 'أخوها', altPhone: '01099887766', notes: 'ملاحظات جديدة', clientContactVia: 'second_number' });
      expect(res.body.lead.clientContactAt).toMatch(STAMP);
    });

    it('an empty string clears a field', async () => {
      const res = await api.patch('repA1', `/leads/${mob.imported}`, { altName: '', altPhone: '', notes: '' });
      expect(res.status).toBe(200);
      expect(res.body.lead).toMatchObject({ altName: null, altPhone: null, notes: null });
    });

    it.each([
      [{}, 'مفيش حاجة تتحدث'],
      [{ name: '   ' }, 'اسم العميل مينفعش يكون فاضي'],
      [{ altPhone: 'zzz' }, 'الرقم التاني مش صحيح - مصري 11 رقم، أو دولة عربية بكود الدولة زي +966…'],
    ])('rejects %j', async (body, error) => {
      const res = await api.patch('repA1', `/leads/${mob.imported}`, body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(error);
    });

    it('the second number must differ from the lead\'s own numbers', async () => {
      const own = await row('own');
      const res = await api.patch('repA1', `/leads/${mob.own}`, { altPhone: own.phone });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ده نفس رقم العميل - الرقم التاني لازم يكون رقم مختلف');
    });

    it('the contact number changes only on leads the rep added themselves, and never onto a taken number', async () => {
      const notMine = await api.patch('repA1', `/leads/${mob.imported}`, { phone: newPhone() });
      expect(notMine.status).toBe(400);
      expect(notMine.body.error).toBe('الرقم بيتعدل بس في الليد اللي إنت ضفته بنفسك');

      const free = newPhone();
      const ok = await api.patch('repA1', `/leads/${mob.own}`, { phone: free });
      expect(ok.status).toBe(200);
      expect(ok.body.lead.phone).toBe(free);

      const taken = await row('colleague');
      const dup = await api.patch('repA1', `/leads/${mob.own}`, { phone: taken.phone });
      expect(dup.status).toBe(409);
      expect(dup.body.error).toBe('الرقم ده متسجل على ليد تاني');

      const bad = await api.patch('repA1', `/leads/${mob.own}`, { phone: 'nope' });
      expect(bad.status).toBe(400);
      expect(bad.body.error).toBe('الرقم مش صحيح - مصري 11 رقم، أو دولة عربية بكود الدولة');
    });

    it("404 for a colleague's, another company's or an unknown lead", async () => {
      for (const id of [mob.colleague, mob.otherCo, 999999]) {
        const res = await api.patch('repA1', `/leads/${id}`, { name: 'hijack' });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('الليد ده مبقاش في قايمتك');
      }
      expect((await row('colleague')).name).toBe('colleague');
      expect((await row('otherCo')).name).toBe('B Secret Lead');
    });

    it('cannot change status, owner, company or source through a PATCH', async () => {
      for (const body of [{ status: 'booked' }, { assigned_user_id: ids.repA2 }, { company_id: ids.B }, { source: 'rep' }, { whatsapp_count: 99 }]) {
        const res = await api.patch('repA1', `/leads/${mob.imported}`, body);
        expect(res.status).toBe(400);
      }
      const after = await row('imported');
      expect(after).toMatchObject({ company_id: ids.A, assigned_user_id: ids.repA1, work_status: 'new', whatsapp_count: 0 });
    });
  });

  // ───────────────────────────── DELETE /leads/:id ─────────────────────────────
  describe('DELETE /leads/:id', () => {
    it('deletes a lead the rep added, with its results', async () => {
      const id = mob.delRep;
      const res = await api.del('repA1', `/leads/${id}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, id });
      expect(await repo(LeadContact).countBy({ id: ids.delRep })).toBe(0);
      expect(await repo(CallResult).countBy({ lead_contact_id: ids.delRep })).toBe(0);
    });

    it('refuses an imported lead; hides colleagues\' and other companies\' leads', async () => {
      const imported = await api.del('repA1', `/leads/${mob.delImported}`);
      expect(imported.status).toBe(400);
      expect(imported.body.error).toBe('بيتمسح بس الليد اللي إنت ضفته بنفسك');
      for (const id of [mob.colleague, mob.otherCo]) {
        const res = await api.del('repA1', `/leads/${id}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('الليد ده مبقاش في قايمتك');
      }
      expect(await repo(LeadContact).countBy({ id: ids.delImported })).toBe(1);
      expect(await repo(LeadContact).countBy({ id: ids.otherCo })).toBe(1);
    });
  });

  // ───────────────────────────── POST /leads/:id/reopen ─────────────────────────────
  describe('POST /leads/:id/reopen', () => {
    it('brings my own finished lead back as a follow-up, keeping the start of the chase', async () => {
      const before = await row('terminal');
      const res = await api.post('repA1', `/leads/${mob.terminal}/reopen`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ok: true, reopened: true, previousStatus: 'not_interested' });
      expect(res.body.lead).toMatchObject({ id: mob.terminal, status: 'follow_up', clientContactVia: 'callback' });
      expect(res.body.lead.whatsapp_sent_at).toBeNull();
      const after = await row('terminal');
      expect(after.first_claimed_at!.getTime()).toBe(before.first_claimed_at!.getTime()); // COALESCE: the chase started earlier
      expect(after.claimed_at!.getTime()).toBeGreaterThan(before.claimed_at!.getTime());
      const manual = await repo(CallResult).findBy({ lead_contact_id: ids.terminal, kind: 'manual', outcome: 'follow_up' });
      expect(manual).toHaveLength(1);
    });

    it('an open lead is just re-stamped: reopened false, status unchanged', async () => {
      const res = await api.post('repA1', `/leads/${mob.imported}/reopen`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ reopened: false, previousStatus: 'new' });
      expect(res.body.lead.status).toBe('new');
    });

    it('a lead I called that is unowned comes back to me; one that a colleague holds is a 409 naming them', async () => {
      const free = await api.post('repA1', `/leads/${mob.touchedFree}/reopen`);
      expect(free.status).toBe(200);
      expect(free.body.reopened).toBe(true);
      expect((await row('touchedFree')).assigned_user_id).toBe(ids.repA1);

      const held = await api.post('repA1', `/leads/${mob.touchedOwned}/reopen`);
      expect(held.status).toBe(409);
      expect(held.body).toMatchObject({ error: 'الليد ده مع repA2 دلوقتي - اطلب من الأدمن ينقله ليك', ownerName: 'repA2' });
      expect((await row('touchedOwned')).assigned_user_id).toBe(ids.repA2);
    });

    it('a lead held by a colleague who is no longer active can be taken back by someone who worked it', async () => {
      await repo(User).update(ids.repA2, { status: UserStatus.INACTIVE } as any);
      const res = await api.post('repA1', `/leads/${mob.touchedOwned}/reopen`);
      await repo(User).update(ids.repA2, { status: UserStatus.ACTIVE } as any);
      expect(res.status).toBe(200);
      expect((await row('touchedOwned')).assigned_user_id).toBe(ids.repA1);
    });

    it('a lead I never touched is 403; another company\'s or an unknown lead does not exist', async () => {
      const stranger = await api.post('repA1', `/leads/${mob.stranger}/reopen`);
      expect(stranger.status).toBe(403);
      expect(stranger.body.error).toBe('الليد ده مش من سجلك');
      for (const id of [mob.otherCo, 999999]) {
        const res = await api.post('repA1', `/leads/${id}/reopen`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('الليد ده مش موجود');
      }
      expect((await row('otherCo')).assigned_user_id).toBe(ids.repB);
    });
  });

  // ───────────────────────────── written-contact / whatsapp-sent ─────────────────────────────
  describe('POST /leads/:id/written-contact', () => {
    it('records the client\'s written reply with the rep\'s reason', async () => {
      const res = await api.post('repA1', `/leads/${mob.nodoctor}/written-contact`, { contactedVia: ' WhatsApp ', contactNote: 'قالت هتحجز بكرة' });
      expect(res.status).toBe(200);
      expect(res.body.lead).toMatchObject({ clientContactVia: 'whatsapp' });
      expect(res.body.lead.clientContactAt).toMatch(STAMP);
      expect((await row('nodoctor')).client_contact_note).toBe('قالت هتحجز بكرة');
    });

    it('refuses a missing channel (with the way out), an unsupported one, and a missing reason', async () => {
      const none = await api.post('repA1', `/leads/${mob.nodoctor}/written-contact`, {});
      expect(none.status).toBe(400);
      expect(none.body).toMatchObject({ error: 'اختار وسيلة التواصل', contactedViaOptions: ['whatsapp'] });
      const sms = await api.post('repA1', `/leads/${mob.nodoctor}/written-contact`, { contactedVia: 'sms', contactNote: 'x' });
      expect(sms.status).toBe(400);
      expect(sms.body.error).toBe('وسيلة تواصل مش مدعومة - المتاح: whatsapp');
      const noNote = await api.post('repA1', `/leads/${mob.nodoctor}/written-contact`, { contactedVia: 'whatsapp' });
      expect(noNote.status).toBe(400);
      expect(noNote.body.error).toBe('اكتب سبب مختصر - العميل قال إيه في المحادثة');
    });

    it('trims the note to 300 characters; a colleague\'s or another company\'s lead is 404', async () => {
      const long = await api.post('repA1', `/leads/${mob.imported}/written-contact`, { contactedVia: 'whatsapp', contactNote: 'ن'.repeat(400) });
      expect(long.status).toBe(200);
      expect((await row('imported')).client_contact_note).toHaveLength(300);
      for (const id of [mob.colleague, mob.otherCo]) {
        expect((await api.post('repA1', `/leads/${id}/written-contact`, { contactedVia: 'whatsapp', contactNote: 'x' })).status).toBe(404);
      }
      expect((await row('colleague')).client_contact_at).toBeNull();
    });
  });

  describe('POST /leads/:id/whatsapp-sent', () => {
    it('counts the send and stamps it; concurrent taps are all counted', async () => {
      const before = (await row('nodoctor')).whatsapp_count;
      const one = await api.post('repA1', `/leads/${mob.nodoctor}/whatsapp-sent`);
      expect(one.status).toBe(200);
      expect(one.body).toMatchObject({ ok: true, whatsappCount: before + 1 });
      expect(one.body.whatsappSentAt).toMatch(STAMP);
      await Promise.all([1, 2, 3].map(() => api.post('repA1', `/leads/${mob.nodoctor}/whatsapp-sent`)));
      expect((await row('nodoctor')).whatsapp_count).toBe(before + 4);
    });

    it("404 for a colleague's or another company's lead, which stay untouched", async () => {
      for (const label of ['colleague', 'otherCo']) {
        const before = (await row(label)).whatsapp_count;
        expect((await api.post('repA1', `/leads/${mob[label]}/whatsapp-sent`)).status).toBe(404);
        expect((await row(label)).whatsapp_count).toBe(before);
      }
    });
  });

  // ───────────────────────────── messages ─────────────────────────────
  describe('GET /leads/:id/doctor-messages', () => {
    it("renders the lead's own doctor's messages in order, with visible blanks for an unbooked appointment", async () => {
      const res = await api.get('repA1', `/leads/${mob.own}/doctor-messages`);
      expect(res.status).toBe(200);
      expect(res.body.doctorId).toBe(mob.docA1);
      expect(res.body.doctorName).toBe('د. أحمد');
      expect(res.body.messages.map((m: any) => m.title)).toEqual(['ترحيب', 'ثانياً']);
      const first = res.body.messages[0];
      expect(Number.isInteger(first.id)).toBe(true);
      expect(first.text).toBe(`أهلاً own مع د. أحمد يوم [اليوم] [التاريخ] الساعة [الساعة]`);
      expect(first.whatsappUrl.startsWith('https://wa.me/201512345678?text=')).toBe(true); // the WhatsApp line, international
      expect(decodeURIComponent(first.whatsappUrl.split('?text=')[1])).toBe(first.text);
    });

    it("never includes another doctor's or another company's messages", async () => {
      const res = await api.get('repA1', `/leads/${mob.own}/doctor-messages`);
      expect(JSON.stringify(res.body)).not.toMatch(/Other doctor|should not appear|B secret/);
    });

    it('a lead with no doctor gets an empty list; a colleague\'s lead is 404', async () => {
      const none = await api.get('repA1', `/leads/${mob.nodoctor}/doctor-messages`);
      expect(none.status).toBe(200);
      expect(none.body).toEqual({ doctorId: null, doctorName: null, messages: [] });
      const other = await api.get('repA1', `/leads/${mob.colleague}/doctor-messages`);
      expect(other.status).toBe(404);
      expect(other.body.error).toBe('الليد ده مبقاش في قايمتك');
    });
  });

  describe('GET /leads/:id/message/:key', () => {
    it('renders the shipped default template with the lead\'s data and a chat link', async () => {
      const res = await api.get('repA1', `/leads/${mob.own}/message/booking_summary`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ key: 'booking_summary', label: 'ملخص الحجز (للنسخ)' });
      expect(res.body.text).toContain('اسم العميل: own');
      expect(res.body.text).toContain('الدكتور: د. أحمد');
      expect(res.body.text).toContain('الموظف: repA1');
      expect(res.body.text).not.toContain('{{');
      expect(res.body.whatsappUrl).toContain('https://wa.me/201512345678?text=');
    });

    it("a company's own wording beats the default, and another company's never applies", async () => {
      const a = await api.get('repA1', `/leads/${mob.own}/message/whatsapp_followup`);
      expect(a.body).toMatchObject({ label: 'متابعة A', text: 'تخصيص A: own' });
      const defaults = await api.get('repA1', `/leads/${mob.own}/message/reminder_call_script`);
      expect(defaults.body.label).toBe('نص مكالمة التذكير');
      const b = await api.get('repB', `/leads/${mob.otherCo}/message/whatsapp_followup`);
      expect(b.body.text).toBe('تخصيص B السري');
      expect(JSON.stringify(a.body)).not.toContain('السري');
    });

    it('404 for an unknown template or someone else\'s lead', async () => {
      const unknown = await api.get('repA1', `/leads/${mob.own}/message/no_such_template`);
      expect(unknown.status).toBe(404);
      expect(unknown.body.error).toBe('القالب ده مش موجود');
      expect((await api.get('repA1', `/leads/${mob.colleague}/message/booking_summary`)).status).toBe(404);
      expect((await api.get('repA1', `/leads/${mob.otherCo}/message/booking_summary`)).status).toBe(404);
    });
  });

  // ───────────────────────────── rules that apply to every route ─────────────────────────────
  describe('auth and subscription rules', () => {
    it('an expired company is blocked on every write with the legacy-shaped 402', async () => {
      const calls = [
        () => api.post('repX', '/leads', { name: 'x', phone: newPhone() }),
        () => api.patch('repX', `/leads/${mob.own}`, { name: 'x' }),
        () => api.del('repX', `/leads/${mob.own}`),
        () => api.post('repX', `/leads/${mob.own}/reopen`),
        () => api.post('repX', `/leads/${mob.own}/written-contact`, { contactedVia: 'whatsapp', contactNote: 'x' }),
        () => api.post('repX', `/leads/${mob.own}/whatsapp-sent`),
        () => api.get('repX', `/leads/${mob.own}/doctor-messages`),
        () => api.get('repX', `/leads/${mob.own}/message/booking_summary`),
      ];
      for (const call of calls) {
        const res = await call();
        expect(res.status).toBe(402);
        expect(res.body.code).toBe('SUBSCRIPTION_EXPIRED');
        expect(typeof res.body.error).toBe('string');
      }
      expect((await row('own')).name).toBe('own');
    });

    it('every route needs a token', async () => {
      const unauth = [
        () => h.http().post('/api/mobile/leads').send({}),
        () => h.http().patch(`/api/mobile/leads/${mob.own}`).send({}),
        () => h.http().delete(`/api/mobile/leads/${mob.own}`),
        () => h.http().post(`/api/mobile/leads/${mob.own}/reopen`).send({}),
        () => h.http().post(`/api/mobile/leads/${mob.own}/written-contact`).send({}),
        () => h.http().post(`/api/mobile/leads/${mob.own}/whatsapp-sent`).send({}),
        () => h.http().get(`/api/mobile/leads/${mob.own}/doctor-messages`),
        () => h.http().get(`/api/mobile/leads/${mob.own}/message/booking_summary`),
      ];
      for (const call of unauth) expect((await call()).status).toBe(401); // one at a time: each supertest call opens its own listener
    });
  });
});
