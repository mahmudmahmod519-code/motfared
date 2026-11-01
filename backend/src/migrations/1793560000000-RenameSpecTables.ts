import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2.2 — retire the port-era tables that collide with the canonical rebuild schema (doc 06).
 * Nine tables are RENAMED (doctors -> spec_doctors, leads -> spec_leads, ...): their rows, columns and relations are kept, nothing is
 * dropped or rewritten. The mobile facade, the seed and the services API keep working on the `spec_*` tables until
 * the rebuilt modules replace them; dropping them later is a separate, explicitly approved destructive migration.
 *
 * MySQL keeps foreign keys pointing at a renamed table, but constraint and index names are per-database/per-table
 * and TypeORM derives them from the table name, so the tables' own foreign keys and hashed indexes are renamed to
 * the names TypeORM now expects (otherwise a new `doctors` table would collide with them and the schema would drift).
 * The data below was produced by comparing the live names with TypeORM's expected ones, then reviewed.
 */
export const RENAMES: [string, string][] = [["doctors", "spec_doctors"], ["doctor_messages", "spec_doctor_messages"], ["user_doctors", "spec_user_doctors"], ["message_templates", "spec_message_templates"], ["call_log_entries", "spec_call_log_entries"], ["call_results", "spec_call_results"], ["company_settings", "spec_company_settings"], ["services", "spec_services"], ["leads", "spec_leads"]];
export const INDEX_RENAMES: [string, string, string][] = [
 [
  "spec_doctors",
  "IDX_2374cf446f8503023a721c744f",
  "IDX_2a267bb574628435f54530aa75"
 ],
 [
  "spec_doctors",
  "IDX_b36298fbabfaf84e507e2a98c3",
  "IDX_ff994d1d2f0cc93b57a61f12e8"
 ],
 [
  "spec_doctor_messages",
  "IDX_5ea3dd6ded13aa7a0e6be79073",
  "IDX_a216713f10c5be6065fec46085"
 ],
 [
  "spec_doctor_messages",
  "IDX_f4a9a762bc2ee97b9f31311ec9",
  "IDX_3a81d213cee0c594c7670d927a"
 ],
 [
  "spec_user_doctors",
  "IDX_31693069c097a53e8ab140ce00",
  "IDX_fe73238b368da4ee0292cd0032"
 ],
 [
  "spec_call_log_entries",
  "IDX_01f8df9d0f6f750fa10d81cac5",
  "IDX_c92d771fa1f5967f38cb0bc591"
 ],
 [
  "spec_call_log_entries",
  "IDX_504486a9803fc55c38c0a2d4cf",
  "IDX_fafbeca6e07d2001fe2962b14b"
 ],
 [
  "spec_call_results",
  "IDX_73eb2ff93eb2fb9ceb0cb6e8c3",
  "IDX_5f89319e169d6436713a49b8f7"
 ],
 [
  "spec_services",
  "IDX_ae72928c203af9570a0625a9a3",
  "IDX_8e809c29a298a157a03ebeb37f"
 ]
];
export const FK_RENAMES: [string, string, string, string, string, string, string][] = [
 [
  "spec_doctors",
  "FK_2374cf446f8503023a721c744f3",
  "FK_2a267bb574628435f54530aa75d",
  "company_id",
  "companies",
  "id",
  "CASCADE"
 ],
 [
  "spec_doctor_messages",
  "FK_d4de70f4b1ee48b92249aa8bae8",
  "FK_ae9fbca70c6a9c39a51e02a7afc",
  "doctor_id",
  "spec_doctors",
  "id",
  "CASCADE"
 ],
 [
  "spec_doctor_messages",
  "FK_f4a9a762bc2ee97b9f31311ec9a",
  "FK_3a81d213cee0c594c7670d927ad",
  "company_id",
  "companies",
  "id",
  "CASCADE"
 ],
 [
  "spec_user_doctors",
  "FK_0df8abe12108ba6a5a58fa3b3f0",
  "FK_7d35bdb7f575bf69076b4d3b4e6",
  "doctor_id",
  "spec_doctors",
  "id",
  "CASCADE"
 ],
 [
  "spec_user_doctors",
  "FK_2b7b6387d9d582f7e3886669762",
  "FK_80bad3a8fb60da52b3b1aef0c72",
  "user_id",
  "users",
  "id",
  "CASCADE"
 ],
 [
  "spec_user_doctors",
  "FK_31693069c097a53e8ab140ce00a",
  "FK_fe73238b368da4ee0292cd00321",
  "company_id",
  "companies",
  "id",
  "CASCADE"
 ],
 [
  "spec_message_templates",
  "FK_b757e2607c244e1c57c3c2245ea",
  "FK_d65e1939869e18a6ea229792fac",
  "company_id",
  "companies",
  "id",
  "CASCADE"
 ],
 [
  "spec_call_log_entries",
  "FK_11951116507ed61f938b7dfa667",
  "FK_4adc6967581cbea136fe061356f",
  "company_id",
  "companies",
  "id",
  "CASCADE"
 ],
 [
  "spec_call_log_entries",
  "FK_256e20f9727c34b446b169dc5da",
  "FK_6b45f1adec8124a93f3e7d190d5",
  "user_id",
  "users",
  "id",
  "RESTRICT"
 ],
 [
  "spec_call_log_entries",
  "FK_504486a9803fc55c38c0a2d4cf0",
  "FK_fafbeca6e07d2001fe2962b14b1",
  "lead_contact_id",
  "lead_contacts",
  "id",
  "SET NULL"
 ],
 [
  "spec_call_results",
  "FK_665500bedc0040d912198d05e80",
  "FK_e84c3015e2a1cf44f6b1c9f9343",
  "company_id",
  "companies",
  "id",
  "CASCADE"
 ],
 [
  "spec_call_results",
  "FK_73eb2ff93eb2fb9ceb0cb6e8c39",
  "FK_5f89319e169d6436713a49b8f71",
  "lead_contact_id",
  "lead_contacts",
  "id",
  "CASCADE"
 ],
 [
  "spec_call_results",
  "FK_aeb957178c5688574e38df3478d",
  "FK_e91a6c53140362a63b5553b9af6",
  "user_id",
  "users",
  "id",
  "RESTRICT"
 ],
 [
  "spec_company_settings",
  "FK_717089d5a18a8b594c0184663ae",
  "FK_39b788a299c0d8313883ac00e77",
  "company_id",
  "companies",
  "id",
  "CASCADE"
 ],
 [
  "spec_services",
  "FK_8e753d53a2de803b47ed9acec4c",
  "FK_2be003d00d6fd1c31027837c1e4",
  "company_id",
  "companies",
  "id",
  "CASCADE"
 ],
 [
  "spec_leads",
  "FK_1f14eab87273052d6a45373601c",
  "FK_ef2eee7941730af648fe4269773",
  "company_id",
  "companies",
  "id",
  "CASCADE"
 ],
 [
  "spec_leads",
  "FK_42b58bb060046fdd335e3b084e9",
  "FK_e2ec3ac9040707cc4adefb33d51",
  "doctor_id",
  "spec_doctors",
  "id",
  "SET NULL"
 ]
];

const original = (t: string) => (t.startsWith('spec_') ? t.slice('spec_'.length) : t);
const wasRenamed = (t: string) => RENAMES.some(([, to]) => to === t);

async function hasIndex(q: QueryRunner, table: string, name: string) {
  const rows = await q.query(
    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
    [table, name],
  );
  return rows.length > 0;
}

export class RenameSpecTables1793560000000 implements MigrationInterface {
  name = 'RenameSpecTables1793560000000';

  public async up(q: QueryRunner): Promise<void> {
    for (const [from, to] of RENAMES) await q.query(`RENAME TABLE \`${from}\` TO \`${to}\``);
    for (const [table, oldFk] of FK_RENAMES) await q.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${oldFk}\``);
    for (const [table, from, to] of INDEX_RENAMES) await q.query(`ALTER TABLE \`${table}\` RENAME INDEX \`${from}\` TO \`${to}\``);
    for (const [table, oldFk, newFk, col, ref, refCol, onDelete] of FK_RENAMES) {
      // the index MySQL created for the constraint carries the constraint's name: it moves with it
      if (await hasIndex(q, table, oldFk)) await q.query(`ALTER TABLE \`${table}\` RENAME INDEX \`${oldFk}\` TO \`${newFk}\``);
      await q.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${newFk}\` FOREIGN KEY (\`${col}\`) REFERENCES \`${ref}\`(\`${refCol}\`) ON DELETE ${onDelete} ON UPDATE NO ACTION`,
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const [from, to] of [...RENAMES].reverse()) await q.query(`RENAME TABLE \`${to}\` TO \`${from}\``);
    const t0 = (t: string) => (wasRenamed(t) ? original(t) : t);
    for (const [table, , newFk] of FK_RENAMES) await q.query(`ALTER TABLE \`${t0(table)}\` DROP FOREIGN KEY \`${newFk}\``);
    for (const [table, from, to] of INDEX_RENAMES) await q.query(`ALTER TABLE \`${t0(table)}\` RENAME INDEX \`${to}\` TO \`${from}\``);
    for (const [table, oldFk, newFk, col, ref, refCol, onDelete] of FK_RENAMES) {
      if (await hasIndex(q, t0(table), newFk)) await q.query(`ALTER TABLE \`${t0(table)}\` RENAME INDEX \`${newFk}\` TO \`${oldFk}\``);
      await q.query(
        `ALTER TABLE \`${t0(table)}\` ADD CONSTRAINT \`${oldFk}\` FOREIGN KEY (\`${col}\`) REFERENCES \`${t0(ref)}\`(\`${refCol}\`) ON DELETE ${onDelete} ON UPDATE NO ACTION`,
      );
    }
  }
}
