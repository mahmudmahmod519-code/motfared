import { MigrationInterface, QueryRunner } from 'typeorm';
import { toCanonicalPhone } from '../common/phone/phone';

/**
 * Mobile login by phone (D7) and session revocation.
 *  - users.token_version: bumped on logout/password change; tokens carry the version they were issued with.
 *  - users.phone_key: canonical phone (backfilled here from existing rows).
 *  - users.active_phone_key: generated column, equals phone_key for pending/active users, with a unique
 *    index, so two active users can never share a phone.
 * Written by hand from the generated migration: the generated one embedded the scratch database name
 * and created the unique index twice. Existing duplicates are reported and abort the migration before
 * any constraint is added.
 */
const GENERATED_EXPRESSION = "CASE WHEN `status` IN ('active','pending') THEN `phone_key` ELSE NULL END";

export class MobileAuth1793473768793 implements MigrationInterface {
  name = 'MobileAuth1793473768793';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Check for conflicts BEFORE any schema change: MySQL DDL cannot be rolled back, so a
    //    failure after the first ALTER would leave the table half migrated.
    const rows: { id: string; email: string; phone: string; status: string }[] = await queryRunner.query(
      `SELECT id, email, phone, status FROM \`users\` WHERE phone IS NOT NULL AND phone <> ''`,
    );
    const keyed = rows.map((r) => ({ ...r, key: toCanonicalPhone(r.phone) })).filter((r) => r.key);
    const liveOwners = new Map<string, string[]>();
    for (const r of keyed) {
      if (r.status === 'active' || r.status === 'pending') liveOwners.set(r.key!, [...(liveOwners.get(r.key!) ?? []), r.email]);
    }
    const duplicates = [...liveOwners.entries()].filter(([, emails]) => emails.length > 1);
    if (duplicates.length) {
      throw new Error(
        'Cannot enforce one active user per phone; resolve these duplicates first (suspend or change a phone): ' +
          duplicates.map(([key, emails]) => `${key}: ${emails.join(', ')}`).join(' | '),
      );
    }

    // 2. Schema + backfill (each step skips what already exists, so a re-run after a crash completes).
    if (!(await queryRunner.hasColumn('users', 'token_version'))) {
      await queryRunner.query(`ALTER TABLE \`users\` ADD \`token_version\` int NOT NULL DEFAULT '0'`);
    }
    if (!(await queryRunner.hasColumn('users', 'phone_key'))) {
      await queryRunner.query(`ALTER TABLE \`users\` ADD \`phone_key\` varchar(20) NULL`);
    }
    for (const r of keyed) await queryRunner.query(`UPDATE \`users\` SET phone_key = ? WHERE id = ?`, [r.key, r.id]);

    if (!(await queryRunner.hasColumn('users', 'active_phone_key'))) {
      await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`active_phone_key\` varchar(20) AS (CASE WHEN \`status\` IN ('active','pending') THEN \`phone_key\` ELSE NULL END) STORED NULL`,
      );
    }
    await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_users_active_phone_key\` ON \`users\` (\`active_phone_key\`)`);

    // TypeORM keeps the expression of generated columns in typeorm_metadata; recording it here keeps
    // `migration:generate` from proposing a spurious change. The database name comes from the live
    // connection (the generated version hard-coded the scratch database).
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`typeorm_metadata\` (\`type\` varchar(255) NOT NULL, \`database\` varchar(255) NULL, \`schema\` varchar(255) NULL, \`table\` varchar(255) NULL, \`name\` varchar(255) NULL, \`value\` text NULL) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `INSERT INTO \`typeorm_metadata\`(\`database\`, \`schema\`, \`table\`, \`type\`, \`name\`, \`value\`) VALUES (DEFAULT, ?, ?, ?, ?, ?)`,
      [queryRunner.connection.options.database, 'users', 'GENERATED_COLUMN', 'active_phone_key', GENERATED_EXPRESSION],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`typeorm_metadata\` WHERE \`type\` = ? AND \`name\` = ? AND \`schema\` = ? AND \`table\` = ?`,
      ['GENERATED_COLUMN', 'active_phone_key', queryRunner.connection.options.database, 'users'],
    );
    await queryRunner.query(`DROP INDEX \`UQ_users_active_phone_key\` ON \`users\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`active_phone_key\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`phone_key\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`token_version\``);
  }
}
