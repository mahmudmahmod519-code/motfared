import { MigrationInterface, QueryRunner } from "typeorm";

export class Billing1793471398598 implements MigrationInterface {
    name = 'Billing1793471398598'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`manual_payment_requests\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(255) NOT NULL, \`plan_price_id\` varchar(255) NOT NULL, \`requested_by\` varchar(255) NOT NULL, \`reference\` varchar(100) NOT NULL, \`reference_key\` varchar(100) NOT NULL, \`payer_phone\` varchar(30) NULL, \`note\` varchar(500) NULL, \`receipt_reference\` varchar(500) NULL, \`expected_amount\` decimal(12,2) NOT NULL, \`currency\` varchar(10) NOT NULL, \`status\` enum ('pending_verification', 'approved', 'rejected') NOT NULL DEFAULT 'pending_verification', \`reviewed_by\` varchar(36) NULL, \`reviewed_at\` timestamp NULL, \`review_note\` varchar(500) NULL, \`subscription_id\` varchar(36) NULL, \`payment_id\` varchar(36) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_473e200a1a3e932bd700d769d6\` (\`company_id\`, \`status\`), UNIQUE INDEX \`IDX_073ce8e9e976396af165d7a056\` (\`reference_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`subscription_provider_refs\` ADD \`last_event_at\` timestamp NULL`);
        await queryRunner.query(`ALTER TABLE \`manual_payment_requests\` ADD CONSTRAINT \`FK_546a3cbb541db95ea40635d4e0a\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`manual_payment_requests\` ADD CONSTRAINT \`FK_4335dafa22530cfcdfd03b9d97d\` FOREIGN KEY (\`plan_price_id\`) REFERENCES \`plan_prices\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`manual_payment_requests\` DROP FOREIGN KEY \`FK_4335dafa22530cfcdfd03b9d97d\``);
        await queryRunner.query(`ALTER TABLE \`manual_payment_requests\` DROP FOREIGN KEY \`FK_546a3cbb541db95ea40635d4e0a\``);
        await queryRunner.query(`ALTER TABLE \`subscription_provider_refs\` DROP COLUMN \`last_event_at\``);
        await queryRunner.query(`DROP INDEX \`IDX_073ce8e9e976396af165d7a056\` ON \`manual_payment_requests\``);
        await queryRunner.query(`DROP INDEX \`IDX_473e200a1a3e932bd700d769d6\` ON \`manual_payment_requests\``);
        await queryRunner.query(`DROP TABLE \`manual_payment_requests\``);
    }

}
