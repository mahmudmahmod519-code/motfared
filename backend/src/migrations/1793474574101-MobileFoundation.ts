import { MigrationInterface, QueryRunner } from 'typeorm';
import { toCanonicalPhone } from '../common/phone/phone';

/**
 * Foundation for the Android port (package B2.1): doctors and rep links, call results, company settings,
 * integer mobile ids, the legacy lead fields on lead_contacts, a per-company unique phone key.
 * Generated, then edited by hand: (1) existing duplicate phones within a company are reported BEFORE any
 * schema change (MySQL DDL cannot be rolled back); (2) `AUTO_INCREMENT` columns must be declared together
 * with their key, which the generated pairs of statements were not; (3) phone_key is backfilled from the
 * existing phones before its unique index is created.
 */

export class MobileFoundation1793474574101 implements MigrationInterface {
    name = 'MobileFoundation1793474574101'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Conflicts first, with no DDL executed yet.
        const rows: { id: string; company_id: string; name: string; phone: string }[] = await queryRunner.query(
            `SELECT id, company_id, name, phone FROM \`lead_contacts\` WHERE phone IS NOT NULL AND phone <> ''`,
        );
        const keyed = rows.map((r) => ({ ...r, key: toCanonicalPhone(r.phone) })).filter((r) => r.key);
        const owners = new Map<string, string[]>();
        for (const r of keyed) owners.set(`${r.company_id}|${r.key}`, [...(owners.get(`${r.company_id}|${r.key}`) ?? []), `${r.name} (${r.id})`]);
        const duplicates = [...owners.entries()].filter(([, who]) => who.length > 1);
        if (duplicates.length) {
            throw new Error(
                'Cannot enforce one lead per phone within a company; merge or edit these duplicates first: ' +
                    duplicates.slice(0, 20).map(([key, who]) => `${key.split('|')[1]}: ${who.join(', ')}`).join(' | ') +
                    (duplicates.length > 20 ? ` … and ${duplicates.length - 20} more` : ''),
            );
        }

        await queryRunner.query(`CREATE TABLE \`doctors\` (\`id\` varchar(36) NOT NULL, \`mobile_id\` int NOT NULL AUTO_INCREMENT, \`company_id\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`team_id\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_2374cf446f8503023a721c744f\` (\`company_id\`), UNIQUE INDEX \`IDX_b36298fbabfaf84e507e2a98c3\` (\`mobile_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`user_doctors\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(255) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`doctor_id\` varchar(255) NOT NULL, \`rank\` enum ('primary', 'secondary', 'tertiary') NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_31693069c097a53e8ab140ce00\` (\`company_id\`), UNIQUE INDEX \`UQ_user_doctors_user_doctor\` (\`user_id\`, \`doctor_id\`), UNIQUE INDEX \`UQ_user_doctors_user_rank\` (\`user_id\`, \`rank\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`company_settings\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(255) NOT NULL, \`key\` varchar(100) NOT NULL, \`value\` text NULL, \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_company_settings_company_key\` (\`company_id\`, \`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`call_results\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(255) NOT NULL, \`lead_contact_id\` varchar(255) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`outcome\` varchar(30) NOT NULL, \`kind\` varchar(20) NOT NULL DEFAULT 'lead', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_73eb2ff93eb2fb9ceb0cb6e8c3\` (\`lead_contact_id\`), INDEX \`IDX_call_results_company_user_created\` (\`company_id\`, \`user_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`team_id\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`services\` ADD \`mobile_id\` int NOT NULL AUTO_INCREMENT, ADD UNIQUE INDEX \`IDX_ae72928c203af9570a0625a9a3\` (\`mobile_id\`)`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`mobile_id\` int NOT NULL AUTO_INCREMENT, ADD UNIQUE INDEX \`IDX_08f0c3db33a8a372bb9d630e66\` (\`mobile_id\`)`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`phone_key\` varchar(20) NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`work_status\` varchar(30) NOT NULL DEFAULT 'new'`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`whatsapp_phone\` varchar(30) NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`alt_name\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`alt_phone\` varchar(30) NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`notes\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`source\` varchar(30) NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`service_id\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`whatsapp_count\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`whatsapp_sent_at\` timestamp NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`client_contact_at\` timestamp NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`client_contact_via\` varchar(30) NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`client_contact_note\` varchar(500) NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`assigned_user_id\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`claimed_at\` timestamp NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`first_claimed_at\` timestamp NULL`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD \`team_id\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`leads\` ADD \`doctor_id\` varchar(36) NULL`);
        for (const r of keyed) await queryRunner.query(`UPDATE \`lead_contacts\` SET phone_key = ? WHERE id = ?`, [r.key, r.id]);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_lead_contacts_company_phone_key\` ON \`lead_contacts\` (\`company_id\`, \`phone_key\`)`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD CONSTRAINT \`FK_8b94e6f2b726d9ba2fb0e23ffae\` FOREIGN KEY (\`service_id\`) REFERENCES \`services\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` ADD CONSTRAINT \`FK_acb8c58c639e03877c269adb7c2\` FOREIGN KEY (\`assigned_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`doctors\` ADD CONSTRAINT \`FK_2374cf446f8503023a721c744f3\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`leads\` ADD CONSTRAINT \`FK_42b58bb060046fdd335e3b084e9\` FOREIGN KEY (\`doctor_id\`) REFERENCES \`doctors\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_doctors\` ADD CONSTRAINT \`FK_31693069c097a53e8ab140ce00a\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_doctors\` ADD CONSTRAINT \`FK_2b7b6387d9d582f7e3886669762\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_doctors\` ADD CONSTRAINT \`FK_0df8abe12108ba6a5a58fa3b3f0\` FOREIGN KEY (\`doctor_id\`) REFERENCES \`doctors\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`company_settings\` ADD CONSTRAINT \`FK_717089d5a18a8b594c0184663ae\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`call_results\` ADD CONSTRAINT \`FK_665500bedc0040d912198d05e80\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`call_results\` ADD CONSTRAINT \`FK_73eb2ff93eb2fb9ceb0cb6e8c39\` FOREIGN KEY (\`lead_contact_id\`) REFERENCES \`lead_contacts\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`call_results\` ADD CONSTRAINT \`FK_aeb957178c5688574e38df3478d\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`call_results\` DROP FOREIGN KEY \`FK_aeb957178c5688574e38df3478d\``);
        await queryRunner.query(`ALTER TABLE \`call_results\` DROP FOREIGN KEY \`FK_73eb2ff93eb2fb9ceb0cb6e8c39\``);
        await queryRunner.query(`ALTER TABLE \`call_results\` DROP FOREIGN KEY \`FK_665500bedc0040d912198d05e80\``);
        await queryRunner.query(`ALTER TABLE \`company_settings\` DROP FOREIGN KEY \`FK_717089d5a18a8b594c0184663ae\``);
        await queryRunner.query(`ALTER TABLE \`user_doctors\` DROP FOREIGN KEY \`FK_0df8abe12108ba6a5a58fa3b3f0\``);
        await queryRunner.query(`ALTER TABLE \`user_doctors\` DROP FOREIGN KEY \`FK_2b7b6387d9d582f7e3886669762\``);
        await queryRunner.query(`ALTER TABLE \`user_doctors\` DROP FOREIGN KEY \`FK_31693069c097a53e8ab140ce00a\``);
        await queryRunner.query(`ALTER TABLE \`leads\` DROP FOREIGN KEY \`FK_42b58bb060046fdd335e3b084e9\``);
        await queryRunner.query(`ALTER TABLE \`doctors\` DROP FOREIGN KEY \`FK_2374cf446f8503023a721c744f3\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP FOREIGN KEY \`FK_acb8c58c639e03877c269adb7c2\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP FOREIGN KEY \`FK_8b94e6f2b726d9ba2fb0e23ffae\``);
        // The existing company_id foreign key relies on this composite index (it is its leading column), so MySQL
        // refuses to drop it directly: drop that foreign key, drop the index, and add the foreign key back
        // (which recreates its own index), keeping the rule it had.
        const [fk] = await queryRunner.query(
            `SELECT k.CONSTRAINT_NAME AS name, r.DELETE_RULE AS del, r.UPDATE_RULE AS upd
             FROM information_schema.KEY_COLUMN_USAGE k
             JOIN information_schema.REFERENTIAL_CONSTRAINTS r
               ON r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
             WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'lead_contacts' AND k.COLUMN_NAME = 'company_id'
               AND k.REFERENCED_TABLE_NAME = 'companies'`,
        );
        if (fk) await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP FOREIGN KEY \`${fk.name}\``);
        await queryRunner.query(`DROP INDEX \`UQ_lead_contacts_company_phone_key\` ON \`lead_contacts\``);
        if (fk) {
            await queryRunner.query(
                `ALTER TABLE \`lead_contacts\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE ${fk.del} ON UPDATE ${fk.upd}`,
            );
        }
        await queryRunner.query(`ALTER TABLE \`leads\` DROP COLUMN \`doctor_id\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`team_id\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`first_claimed_at\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`claimed_at\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`assigned_user_id\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`client_contact_note\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`client_contact_via\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`client_contact_at\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`whatsapp_sent_at\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`whatsapp_count\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`service_id\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`source\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`notes\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`alt_phone\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`alt_name\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`whatsapp_phone\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`work_status\``);
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`phone_key\``);
        // an AUTO_INCREMENT column must keep its key until it is dropped: dropping the column drops the index with it
        await queryRunner.query(`ALTER TABLE \`lead_contacts\` DROP COLUMN \`mobile_id\``);
        // an AUTO_INCREMENT column must keep its key until it is dropped: dropping the column drops the index with it
        await queryRunner.query(`ALTER TABLE \`services\` DROP COLUMN \`mobile_id\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`team_id\``);
        await queryRunner.query(`DROP INDEX \`IDX_call_results_company_user_created\` ON \`call_results\``);
        await queryRunner.query(`DROP INDEX \`IDX_73eb2ff93eb2fb9ceb0cb6e8c3\` ON \`call_results\``);
        await queryRunner.query(`DROP TABLE \`call_results\``);
        await queryRunner.query(`DROP INDEX \`UQ_company_settings_company_key\` ON \`company_settings\``);
        await queryRunner.query(`DROP TABLE \`company_settings\``);
        await queryRunner.query(`DROP INDEX \`UQ_user_doctors_user_rank\` ON \`user_doctors\``);
        await queryRunner.query(`DROP INDEX \`UQ_user_doctors_user_doctor\` ON \`user_doctors\``);
        await queryRunner.query(`DROP INDEX \`IDX_31693069c097a53e8ab140ce00\` ON \`user_doctors\``);
        await queryRunner.query(`DROP TABLE \`user_doctors\``);
        // doctors.mobile_id is AUTO_INCREMENT: its key must stay until the table itself is dropped
        await queryRunner.query(`DROP INDEX \`IDX_2374cf446f8503023a721c744f\` ON \`doctors\``);
        await queryRunner.query(`DROP TABLE \`doctors\``);
    }

}
