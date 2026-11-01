/**
 * TypeORM CLI data source (migrations). The running app configures its own connection in
 * app.module.ts; keep the two in sync.
 *
 *   npm run migration:generate -- src/migrations/<Name>   (needs a DB at the previous schema)
 *   npm run migration:run
 *   npm run migration:revert
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'saas_user',
  password: process.env.DB_PASSWORD || 'saas_pass',
  database: process.env.DB_DATABASE || 'saas_crm',
  charset: 'utf8mb4',
  timezone: 'Z',
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
});
