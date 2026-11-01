import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * users.must_change_password: set (by the import tool) for accounts that carry a temporary
 * password; the API refuses everything except sign-out, profile and change-password until it is cleared.
 * Additive and defaulted, so existing rows are unaffected.
 */
export class MustChangePassword1793480000000 implements MigrationInterface {
  name = 'MustChangePassword1793480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'must_change_password'))) {
      await queryRunner.query(`ALTER TABLE \`users\` ADD \`must_change_password\` tinyint NOT NULL DEFAULT 0`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`must_change_password\``);
  }
}
