import { MigrationInterface, QueryRunner } from "typeorm";

/** Doctor messages and per-company message templates (package B2.4). Generated; the down() was hand-fixed. */

export class MobileMessages1793476366378 implements MigrationInterface {
    name = 'MobileMessages1793476366378'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`message_templates\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(255) NOT NULL, \`key\` varchar(100) NOT NULL, \`label\` varchar(255) NOT NULL, \`body\` text NOT NULL, \`updated_by\` varchar(36) NULL, \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_message_templates_company_key\` (\`company_id\`, \`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`doctor_messages\` (\`id\` varchar(36) NOT NULL, \`mobile_id\` int NOT NULL AUTO_INCREMENT, \`company_id\` varchar(255) NOT NULL, \`doctor_id\` varchar(255) NOT NULL, \`title\` varchar(255) NOT NULL, \`body\` text NOT NULL, \`sort_order\` int NOT NULL DEFAULT '0', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_f4a9a762bc2ee97b9f31311ec9\` (\`company_id\`), INDEX \`IDX_doctor_messages_doctor_sort\` (\`doctor_id\`, \`sort_order\`), UNIQUE INDEX \`IDX_5ea3dd6ded13aa7a0e6be79073\` (\`mobile_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`message_templates\` ADD CONSTRAINT \`FK_b757e2607c244e1c57c3c2245ea\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`doctor_messages\` ADD CONSTRAINT \`FK_f4a9a762bc2ee97b9f31311ec9a\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`doctor_messages\` ADD CONSTRAINT \`FK_d4de70f4b1ee48b92249aa8bae8\` FOREIGN KEY (\`doctor_id\`) REFERENCES \`doctors\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    // Tables are dropped with their indexes: an AUTO_INCREMENT key (doctor_messages.mobile_id) and the index a
    // foreign key relies on (message_templates company_id) cannot be dropped on their own.
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`doctor_messages\` DROP FOREIGN KEY \`FK_d4de70f4b1ee48b92249aa8bae8\``);
        await queryRunner.query(`ALTER TABLE \`doctor_messages\` DROP FOREIGN KEY \`FK_f4a9a762bc2ee97b9f31311ec9a\``);
        await queryRunner.query(`ALTER TABLE \`message_templates\` DROP FOREIGN KEY \`FK_b757e2607c244e1c57c3c2245ea\``);
        await queryRunner.query(`DROP TABLE \`doctor_messages\``);
        await queryRunner.query(`DROP TABLE \`message_templates\``);
    }

}
