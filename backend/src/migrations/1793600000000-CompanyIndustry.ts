import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Companies of any industry (src/modules/companies/industry/industries.ts):
 * - `industry`: the template the company's words and optional features come from. Existing companies become
 *   `clinic` (the original product, so nothing they see changes), except where `type_company` already says
 *   otherwise.
 * - `terms`, `features`: only the owner's own overrides on top of the template (NULL = none).
 * - `logo_url`: the company's logo for its white-labelled dashboard.
 * Additive: no column or row is removed; `down` drops only what `up` added.
 */
export class CompanyIndustry1793600000000 implements MigrationInterface {
  name = 'CompanyIndustry1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('companies', 'industry'))) {
      await queryRunner.query(`ALTER TABLE \`companies\` ADD \`industry\` varchar(30) NOT NULL DEFAULT 'clinic'`);
      await queryRunner.query(
        `UPDATE \`companies\` SET \`industry\` = CASE LOWER(TRIM(\`type_company\`))
           WHEN 'kitchen' THEN 'kitchens' WHEN 'kitchens' THEN 'kitchens'
           WHEN 'real_estate' THEN 'real_estate' WHEN 'real estate' THEN 'real_estate'
           WHEN 'sales' THEN 'sales'
           ELSE 'clinic' END`,
      );
    }
    if (!(await queryRunner.hasColumn('companies', 'terms'))) {
      await queryRunner.query(`ALTER TABLE \`companies\` ADD \`terms\` json NULL`);
    }
    if (!(await queryRunner.hasColumn('companies', 'features'))) {
      await queryRunner.query(`ALTER TABLE \`companies\` ADD \`features\` json NULL`);
    }
    if (!(await queryRunner.hasColumn('companies', 'logo_url'))) {
      await queryRunner.query(`ALTER TABLE \`companies\` ADD \`logo_url\` varchar(1000) NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`companies\` DROP COLUMN \`logo_url\``);
    await queryRunner.query(`ALTER TABLE \`companies\` DROP COLUMN \`features\``);
    await queryRunner.query(`ALTER TABLE \`companies\` DROP COLUMN \`terms\``);
    await queryRunner.query(`ALTER TABLE \`companies\` DROP COLUMN \`industry\``);
  }
}
