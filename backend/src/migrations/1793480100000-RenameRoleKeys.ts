import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Role keys follow the approved plan (D-05): owner / admin / team_lead / sales.
 * The generated spec used ceo / crm_manager / call_center; existing memberships are renamed in place
 * (data only, no schema change). down() restores the old names; it is exact only while no team_lead
 * exists and no new "admin" was added after the rename.
 */
export class RenameRoleKeys1793480100000 implements MigrationInterface {
  name = 'RenameRoleKeys1793480100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`company_memberships\` SET \`role\` = CASE \`role\` WHEN 'ceo' THEN 'owner' WHEN 'crm_manager' THEN 'admin' WHEN 'call_center' THEN 'sales' ELSE \`role\` END`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`company_memberships\` SET \`role\` = CASE \`role\` WHEN 'owner' THEN 'ceo' WHEN 'admin' THEN 'crm_manager' WHEN 'sales' THEN 'call_center' ELSE \`role\` END`,
    );
  }
}
