import { MigrationInterface, QueryRunner } from "typeorm";

/** The rep's synced phone call log (package B5). Generated; the down() was hand-fixed. */

export class CallLog1793477150115 implements MigrationInterface {
    name = 'CallLog1793477150115'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`call_log_entries\` (\`id\` varchar(36) NOT NULL, \`mobile_id\` int NOT NULL AUTO_INCREMENT, \`company_id\` varchar(255) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`phone_number\` varchar(30) NOT NULL, \`lead_contact_id\` varchar(36) NULL, \`direction\` varchar(10) NOT NULL, \`duration_seconds\` int NOT NULL DEFAULT '0', \`occurred_at\` bigint NOT NULL, \`device_call_id\` bigint NULL, \`cached_name\` varchar(200) NULL, \`phone_account_id\` varchar(100) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_504486a9803fc55c38c0a2d4cf\` (\`lead_contact_id\`), INDEX \`IDX_call_log_company_number\` (\`company_id\`, \`phone_number\`), INDEX \`IDX_call_log_user_device\` (\`user_id\`, \`device_call_id\`), INDEX \`IDX_call_log_company_user_time\` (\`company_id\`, \`user_id\`, \`occurred_at\`), UNIQUE INDEX \`IDX_01f8df9d0f6f750fa10d81cac5\` (\`mobile_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`call_log_entries\` ADD CONSTRAINT \`FK_11951116507ed61f938b7dfa667\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`call_log_entries\` ADD CONSTRAINT \`FK_256e20f9727c34b446b169dc5da\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`call_log_entries\` ADD CONSTRAINT \`FK_504486a9803fc55c38c0a2d4cf0\` FOREIGN KEY (\`lead_contact_id\`) REFERENCES \`lead_contacts\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    // The table goes with its indexes (an AUTO_INCREMENT key and the indexes foreign keys rely on cannot be dropped alone).
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`call_log_entries\` DROP FOREIGN KEY \`FK_504486a9803fc55c38c0a2d4cf0\``);
        await queryRunner.query(`ALTER TABLE \`call_log_entries\` DROP FOREIGN KEY \`FK_256e20f9727c34b446b169dc5da\``);
        await queryRunner.query(`ALTER TABLE \`call_log_entries\` DROP FOREIGN KEY \`FK_11951116507ed61f938b7dfa667\``);
        await queryRunner.query(`DROP TABLE \`call_log_entries\``);
    }

}
