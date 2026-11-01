/**
 * Phase 2.2 — what the DATABASE itself guarantees for the rebuilt tenant domain (docs/rebuild/06), tried
 * directly against MySQL with the schema built from the real migrations, bypassing every service and guard.
 * Written before the migration was finalised.
 */
import { bootstrap } from './harness';
import { Team } from '../../src/domain/core/team.entity';
import { Doctor } from '../../src/domain/core/doctor.entity';
import { Campaign } from '../../src/domain/core/campaign.entity';
import { Service } from '../../src/domain/core/service.entity';
import { Upload } from '../../src/domain/core/upload.entity';
import { Lead } from '../../src/domain/core/lead.entity';
import { LeadPhone } from '../../src/domain/core/lead-phone.entity';
import { UserDoctor } from '../../src/domain/core/user-doctor.entity';
import { CompanyMembership } from '../../src/modules/company-memberships/entities/company-membership.entity';

const code = (e: any) => e?.code ?? e?.driverError?.code;
/** The statement must fail with the given MySQL error code. */
const fails = async (p: Promise<unknown>, expected: string) => {
  let err: any;
  try { await p; } catch (e) { err = e; }
  expect({ failed: !!err, code: code(err) }).toEqual({ failed: true, code: expected });
};
const NO_PARENT = 'ER_NO_REFERENCED_ROW_2';
const HAS_CHILD = 'ER_ROW_IS_REFERENCED_2';
const DUP = 'ER_DUP_ENTRY';

describe('Rebuilt tenant domain: database guarantees', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const A: Record<string, any> = {};
  const B: Record<string, any> = {};
  let nextPhone = 0;
  const key = () => `01${String(++nextPhone).padStart(9, '0')}`;

  const lead = (co: Record<string, any>, extra: Record<string, any> = {}) =>
    h.db.getRepository(Lead).insert({ company_id: co.id, name: 'L', phone: key(), campaign_id: co.campaign, ...extra } as any);

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    for (const [co, tag] of [[A, 'A'], [B, 'B']] as const) {
      co.id = (await h.mkCompany(`Domain ${tag}`)).id;
      co.rep = (await h.mkUser(`Rep ${tag}`, `rep-${tag}@d.test`, co.id, 'sales')).id;
      co.team = (await h.db.getRepository(Team).insert({ company_id: co.id, name: `Team ${tag}`, code: tag } as any)).identifiers[0].id;
      co.doctor = (await h.db.getRepository(Doctor).insert({ company_id: co.id, name: `Dr ${tag}`, team_id: co.team, slug: `dr-${tag.toLowerCase()}` } as any)).identifiers[0].id;
      co.campaign = (await h.db.getRepository(Campaign).insert({ company_id: co.id, doctor_id: co.doctor, name: `Camp ${tag}` } as any)).identifiers[0].id;
      co.service = (await h.db.getRepository(Service).insert({ company_id: co.id, name: `Svc ${tag}` } as any)).identifiers[0].id;
      co.upload = (await h.db.getRepository(Upload).insert({ company_id: co.id, campaign_id: co.campaign, total_rows: 1, valid_count: 1, duplicate_count: 0, invalid_count: 0 } as any)).identifiers[0].id;
    }
    B.outsider = (await h.mkUser('No company', 'outsider@d.test', null)).id; // a platform-level user without membership
  });
  afterAll(async () => { await h.app?.close(); });

  describe('the port-era tables were moved aside, not lost', () => {
    it('the canonical names now hold the new BIGINT tables and the old ones live on as spec_*', async () => {
      const cols = await h.db.query(
        "SELECT TABLE_NAME t, COLUMN_TYPE c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'id' AND TABLE_NAME IN ('doctors','leads','services','user_doctors','spec_doctors','spec_leads','spec_services','spec_user_doctors')",
      );
      const type = Object.fromEntries(cols.map((r: any) => [r.t, r.c]));
      for (const t of ['doctors', 'leads', 'services', 'user_doctors']) expect(type[t]).toBe('bigint unsigned');
      for (const t of ['spec_doctors', 'spec_leads', 'spec_services', 'spec_user_doctors']) expect(type[t]).toBe('varchar(36)');
    });
  });

  describe('structural invariants of every rebuilt table (checked in the schema, so a new table cannot forget them)', () => {
    const DOMAIN = ['teams', 'doctors', 'campaigns', 'services', 'uploads', 'leads', 'lead_phones', 'user_doctors'];
    const list = DOMAIN.map((t) => `'${t}'`).join(',');

    it('every table carries a NOT NULL company_id', async () => {
      const rows = await h.db.query(
        `SELECT TABLE_NAME t, IS_NULLABLE n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'company_id' AND TABLE_NAME IN (${list})`,
      );
      expect(rows.map((r: any) => r.t).sort()).toEqual([...DOMAIN].sort());
      for (const r of rows) expect([r.t, r.n]).toEqual([r.t, 'NO']);
    });

    it('every table another table points into has UNIQUE (company_id, id)', async () => {
      const parents = ['teams', 'doctors', 'campaigns', 'services', 'uploads', 'leads'];
      for (const t of parents) {
        const rows = await h.db.query(
          "SELECT INDEX_NAME i, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND NON_UNIQUE = 0 GROUP BY INDEX_NAME",
          [t],
        );
        expect([t, rows.some((r: any) => r.c === 'company_id,id')]).toEqual([t, true]);
      }
    });

    it('every foreign key from a rebuilt table is either the company link or a composite key that starts with company_id', async () => {
      const fks = await h.db.query(
        `SELECT k.TABLE_NAME t, k.CONSTRAINT_NAME n, k.REFERENCED_TABLE_NAME r, GROUP_CONCAT(k.COLUMN_NAME ORDER BY k.ORDINAL_POSITION) c
           FROM information_schema.KEY_COLUMN_USAGE k
          WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME IN (${list}) AND k.REFERENCED_TABLE_NAME IS NOT NULL
          GROUP BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.REFERENCED_TABLE_NAME`,
      );
      expect(fks.length).toBeGreaterThan(15);
      for (const f of fks) {
        const company = f.r === 'companies';
        const composite = String(f.c).startsWith('company_id,');
        expect({ fk: f.n, ok: company ? f.c === 'company_id' : composite }).toEqual({ fk: f.n, ok: true });
      }
    });

    it('every table\'s company link refuses to delete a company that owns data (RESTRICT, never CASCADE)', async () => {
      const rules = await h.db.query(
        `SELECT TABLE_NAME t, DELETE_RULE r FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'companies' AND TABLE_NAME IN (${list})`,
      );
      expect(rules.map((r: any) => r.t).sort()).toEqual([...DOMAIN].sort());
      for (const r of rules) expect([r.t, r.r]).toEqual([r.t, 'RESTRICT']);
    });

    it('no foreign key from a rebuilt table SET NULLs (it would blank company_id too)', async () => {
      const rows = await h.db.query(
        `SELECT TABLE_NAME t, CONSTRAINT_NAME n FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME IN (${list}) AND DELETE_RULE = 'SET NULL'`,
      );
      expect(rows).toEqual([]);
    });
  });

  describe('ids', () => {
    it('are numbers, and an explicit (legacy) id is kept; auto-increment continues after it', async () => {
      const repo = h.db.getRepository(Doctor);
      await repo.insert({ id: 4242, company_id: A.id, name: 'Legacy 4242' } as any);
      const row = await repo.findOneByOrFail({ id: 4242 });
      expect(row.id).toBe(4242);
      expect(typeof row.id).toBe('number');
      const next = await repo.insert({ company_id: A.id, name: 'After legacy' } as any);
      expect(next.identifiers[0].id).toBeGreaterThan(4242);
      expect(typeof (await repo.findOneByOrFail({ name: 'After legacy' })).company_id).toBe('string');
    });
  });

  describe('composite foreign keys: a row can never point into another company', () => {
    it("a doctor cannot be placed in another company's team", async () => {
      await fails(h.db.getRepository(Doctor).insert({ company_id: A.id, name: 'x', team_id: B.team } as any), NO_PARENT);
    });
    it("a campaign cannot belong to another company's doctor", async () => {
      await fails(h.db.getRepository(Campaign).insert({ company_id: A.id, doctor_id: B.doctor, name: 'x' } as any), NO_PARENT);
    });
    it("an upload cannot go into another company's campaign or be attributed to another company's user", async () => {
      const base = { company_id: A.id, total_rows: 0, valid_count: 0, duplicate_count: 0, invalid_count: 0 };
      await fails(h.db.getRepository(Upload).insert({ ...base, campaign_id: B.campaign } as any), NO_PARENT);
      await fails(h.db.getRepository(Upload).insert({ ...base, campaign_id: A.campaign, uploaded_by: B.rep } as any), NO_PARENT);
      await expect(h.db.getRepository(Upload).insert({ ...base, campaign_id: A.campaign, uploaded_by: A.rep } as any)).resolves.toBeDefined();
    });
    it('a lead cannot use another company\'s campaign, upload, service or owner', async () => {
      await fails(lead(A, { campaign_id: B.campaign }), NO_PARENT);
      await fails(lead(A, { upload_id: B.upload }), NO_PARENT);
      await fails(lead(A, { service_id: B.service }), NO_PARENT);
      await fails(lead(A, { owner_user_id: B.rep }), NO_PARENT);
    });
    it('a lead cannot be owned by someone who is not a member of its company (a platform-level user)', async () => {
      await fails(lead(A, { owner_user_id: B.outsider }), NO_PARENT);
    });
    it('optional links may simply be empty (NULL parts are not checked)', async () => {
      await expect(lead(A)).resolves.toBeDefined(); // no owner, upload or service: it waits in the doctor's pool
      await expect(lead(A, { owner_user_id: A.rep, service_id: A.service, upload_id: A.upload })).resolves.toBeDefined();
    });
    it('a rep cannot be linked to another company\'s doctor, and a doctor cannot be linked for another company\'s rep', async () => {
      const link = (company: string, user: string, doctor: number, rank: string) =>
        h.db.getRepository(UserDoctor).insert({ company_id: company, user_id: user, doctor_id: doctor, rank } as any);
      await fails(link(A.id, A.rep, B.doctor, 'primary'), NO_PARENT);
      await fails(link(A.id, B.rep, A.doctor, 'primary'), NO_PARENT);
      await expect(link(A.id, A.rep, A.doctor, 'primary')).resolves.toBeDefined();
    });
    it('a membership cannot take another company\'s team', async () => {
      await fails(h.db.getRepository(CompanyMembership).update({ user_id: A.rep }, { team_id: B.team } as any), NO_PARENT);
      await h.db.getRepository(CompanyMembership).update({ user_id: A.rep }, { team_id: A.team } as any);
      expect((await h.db.getRepository(CompanyMembership).findOneByOrFail({ user_id: A.rep })).team_id).toBe(A.team);
    });
  });

  describe('history is protected, derived rows follow their parent', () => {
    it('a doctor with campaigns, a campaign with leads, a service in use and a team with doctors cannot be deleted', async () => {
      await fails(h.db.getRepository(Doctor).delete({ id: A.doctor }), HAS_CHILD);
      await fails(h.db.getRepository(Campaign).delete({ id: A.campaign }), HAS_CHILD);
      await fails(h.db.getRepository(Service).delete({ id: A.service }), HAS_CHILD);
      await fails(h.db.getRepository(Team).delete({ id: A.team }), HAS_CHILD);
    });
    it('a company with data cannot be deleted', async () => {
      await fails(h.db.query('DELETE FROM companies WHERE id = ?', [A.id]), HAS_CHILD);
    });
    it('a member who owns a lead cannot be removed (users are deactivated, never deleted)', async () => {
      await fails(h.db.getRepository(CompanyMembership).delete({ user_id: A.rep }), HAS_CHILD);
    });
    it('deleting a lead deletes its phone keys', async () => {
      const id = (await lead(A)).identifiers[0].id;
      await h.db.getRepository(LeadPhone).insert({ company_id: A.id, lead_id: id, kind: 'phone', phone_key: 'cascade-1' } as any);
      await h.db.getRepository(Lead).delete({ id });
      expect(await h.db.getRepository(LeadPhone).countBy({ phone_key: 'cascade-1' })).toBe(0);
    });
  });

  describe('a number belongs to one lead per company', () => {
    const phone = (co: Record<string, any>, leadId: number, kind: string, phone_key: string) =>
      h.db.getRepository(LeadPhone).insert({ company_id: co.id, lead_id: leadId, kind, phone_key } as any);

    it('two leads cannot share a number in the same company, whichever column it sits in', async () => {
      const l1 = (await lead(A)).identifiers[0].id;
      const l2 = (await lead(A)).identifiers[0].id;
      await phone(A, l1, 'phone', '01099990001');
      await fails(phone(A, l2, 'whatsapp', '01099990001'), DUP);
      await fails(phone(A, l2, 'alt', '01099990001'), DUP);
    });
    it('the same number may belong to a lead of another company', async () => {
      const lb = (await lead(B)).identifiers[0].id;
      await expect(phone(B, lb, 'phone', '01099990001')).resolves.toBeDefined();
    });
    it('a lead has at most one number per kind', async () => {
      const l = (await lead(A)).identifiers[0].id;
      await phone(A, l, 'alt', '01099990002');
      await fails(phone(A, l, 'alt', '01099990003'), DUP);
    });
    it('a number cannot be attached to another company\'s lead', async () => {
      const lb = (await lead(B)).identifiers[0].id;
      await fails(phone(A, lb, 'phone', '01099990004'), NO_PARENT);
    });
    it('only the three kinds exist', async () => {
      const l = (await lead(A)).identifiers[0].id;
      await fails(phone(A, l, 'fax', '01099990005'), 'WARN_DATA_TRUNCATED');
    });
  });

  describe('a rep has at most three doctors, one per rank', () => {
    let rep: string;
    const d: number[] = [];
    const link = (doctor: number, rank: string) => h.db.getRepository(UserDoctor).insert({ company_id: A.id, user_id: rep, doctor_id: doctor, rank } as any);
    beforeAll(async () => {
      rep = (await h.mkUser('Rep A2', 'rep-A2@d.test', A.id, 'sales')).id;
      for (let i = 0; i < 4; i++) d.push((await h.db.getRepository(Doctor).insert({ company_id: A.id, name: `D${i}` } as any)).identifiers[0].id);
    });
    it('fills primary, secondary and tertiary', async () => {
      for (const [i, rank] of ['primary', 'secondary', 'tertiary'].entries()) await expect(link(d[i], rank)).resolves.toBeDefined();
    });
    it('refuses a fourth doctor (no fourth rank), a repeated rank and a repeated doctor', async () => {
      await fails(link(d[3], 'quaternary'), 'WARN_DATA_TRUNCATED');
      await fails(link(d[3], 'primary'), DUP);
      await fails(link(d[0], 'secondary'), DUP);
    });
  });

  describe('one company per person (D-07)', () => {
    it('a user cannot hold a second membership, in another company or in the same one', async () => {
      const repo = h.db.getRepository(CompanyMembership);
      await fails(repo.insert({ company_id: B.id, user_id: A.rep, role: 'sales' } as any), DUP);
      await fails(repo.insert({ company_id: A.id, user_id: A.rep, role: 'admin' } as any), DUP);
    });
  });

  describe('uniqueness rules of the original', () => {
    it('a service name is unique within a company only', async () => {
      await fails(h.db.getRepository(Service).insert({ company_id: A.id, name: 'Svc A' } as any), DUP);
      await expect(h.db.getRepository(Service).insert({ company_id: B.id, name: 'Svc A' } as any)).resolves.toBeDefined();
    });
    it('a team code is unique within a company only', async () => {
      await fails(h.db.getRepository(Team).insert({ company_id: A.id, name: 'again', code: 'A' } as any), DUP);
      await expect(h.db.getRepository(Team).insert({ company_id: B.id, name: 'again', code: 'A' } as any)).resolves.toBeDefined();
    });
    it('a doctor\'s public slug is unique across ALL companies (it is a URL), and doctors without one are fine', async () => {
      await fails(h.db.getRepository(Doctor).insert({ company_id: B.id, name: 'x', slug: 'dr-a' } as any), DUP);
      await expect(h.db.getRepository(Doctor).insert({ company_id: A.id, name: 'no slug 1' } as any)).resolves.toBeDefined();
      await expect(h.db.getRepository(Doctor).insert({ company_id: A.id, name: 'no slug 2' } as any)).resolves.toBeDefined();
    });
  });

  describe('lead values', () => {
    it('only the ten statuses and the known sources are accepted', async () => {
      await fails(lead(A, { status: 'won' }), 'WARN_DATA_TRUNCATED');
      await fails(lead(A, { source: 'telepathy' }), 'WARN_DATA_TRUNCATED');
      for (const status of ['new', 'no_answer', 'interested', 'very_interested', 'follow_up', 'booked', 'examined', 'no_show', 'not_interested', 'unreachable']) {
        await expect(lead(A, { status })).resolves.toBeDefined();
      }
    });
    it('a lead starts as new with no WhatsApp sent and keeps Arabic text byte for byte', async () => {
      const text = 'عميل جديد — متابعة 😀';
      const id = (await lead(A, { name: text, notes: text })).identifiers[0].id;
      const row = await h.db.getRepository(Lead).findOneByOrFail({ id });
      expect(row.status).toBe('new');
      expect(row.whatsapp_count).toBe(0);
      expect(row.name).toBe(text);
      expect(row.notes).toBe(text);
    });
  });
});
