import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Roles and permissions (Phase 1). Generated, then: the permission catalogue is seeded here as a
 * frozen snapshot (a later catalogue change gets its own migration; a test compares the table with
 * permissions.catalogue.ts), and down() drops the tables whole.
 */
const PERMISSIONS_V1: [string, string, string][] = [
  ['leads.work', 'leads', 'Work own leads: claim, record call outcomes, own bookings, follow-ups and reminders'],
  ['leads.manage', 'leads', 'Add, edit and delete leads; reassign bookings; return leads to the pool; redistribute a rep\'s book'],
  ['uploads.manage', 'leads', 'Import leads from Excel files and Google Sheets'],
  ['doctors.manage', 'leads', 'Manage clinics and campaigns, and which reps are linked to which clinic'],
  ['dashboard.view', 'reports', 'Open the management dashboard'],
  ['reports.view', 'reports', 'View performance, history and operational reports'],
  ['finance.view', 'finance', 'View finance figures'],
  ['finance.manage', 'finance', 'Record and edit finance entries'],
  ['accounts.view', 'accounts', 'See the accounts of the team'],
  ['accounts.manage', 'accounts', 'Create and edit sales accounts and their clinic links'],
  ['accounts.admin', 'accounts', 'Create admins and team leads, deactivate any account'],
  ['accounts.unrestrict', 'accounts', 'Switch the "unrestricted" exemption on or off for an account'],
  ['scope.all_teams', 'accounts', 'See and act on every team instead of only one\'s own'],
  ['settings.manage', 'settings', 'Change company settings (claim window, weekly day off, labels)'],
  ['templates.manage', 'settings', 'Manage message templates'],
  ['services.manage', 'settings', 'Manage the service catalogue'],
  ['roles.view', 'security', 'See roles and their permissions'],
  ['roles.manage', 'security', 'Create custom roles and change what a role may do'],
  ['data.backup', 'security', 'Download backups and export company data'],
  ['billing.view', 'billing', 'See the subscription, invoices and payments'],
  ['billing.manage', 'billing', 'Change plan, pay, cancel or renew the subscription'],
];

export class Rbac1793546581084 implements MigrationInterface {
    name = 'Rbac1793546581084'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`permissions\` (\`key\` varchar(64) NOT NULL, \`group_name\` varchar(50) NOT NULL, \`description\` varchar(255) NOT NULL, PRIMARY KEY (\`key\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`role_permissions\` (\`role_id\` varchar(36) NOT NULL, \`permission_key\` varchar(64) NOT NULL, PRIMARY KEY (\`role_id\`, \`permission_key\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`roles\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(255) NOT NULL, \`key\` varchar(64) NOT NULL, \`name\` varchar(100) NOT NULL, \`is_system\` tinyint NOT NULL DEFAULT 0, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_roles_company_key\` (\`company_id\`, \`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`role_permissions\` ADD CONSTRAINT \`FK_178199805b901ccd220ab7740ec\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`role_permissions\` ADD CONSTRAINT \`FK_8b7b2f0714335aa02b2171f4741\` FOREIGN KEY (\`permission_key\`) REFERENCES \`permissions\`(\`key\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`roles\` ADD CONSTRAINT \`FK_4bc1204a05dde26383e3955b0a1\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);

        for (const [key, group, description] of PERMISSIONS_V1) {
            await queryRunner.query(`INSERT INTO \`permissions\` (\`key\`, \`group_name\`, \`description\`) VALUES (?, ?, ?)`, [key, group, description]);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`roles\` DROP FOREIGN KEY \`FK_4bc1204a05dde26383e3955b0a1\``);
        await queryRunner.query(`ALTER TABLE \`role_permissions\` DROP FOREIGN KEY \`FK_8b7b2f0714335aa02b2171f4741\``);
        await queryRunner.query(`ALTER TABLE \`role_permissions\` DROP FOREIGN KEY \`FK_178199805b901ccd220ab7740ec\``);
        await queryRunner.query(`DROP TABLE \`roles\``);
        await queryRunner.query(`DROP TABLE \`role_permissions\``);
        await queryRunner.query(`DROP TABLE \`permissions\``);
    }

}
