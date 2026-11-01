/**
 * Global Setup for E2E Tests
 * Sets up test database, runs migrations, seeds data
 */

import { execSync } from 'child_process';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config({ path: '.env.test' });

export default async function () {
  console.log('\n🔧 Setting up E2E test environment...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DB_HOST = process.env.DB_HOST || 'localhost';
  process.env.DB_PORT = process.env.DB_PORT || '3306';
  process.env.DB_USERNAME = process.env.DB_USERNAME || 'saas_user';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'saas_pass';
  process.env.DB_DATABASE = 'saas_crm_test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-do-not-use-in-production';
  process.env.JWT_EXPIRES_IN = '7d';

  try {
    // Create test database if not exists
    const ds = new DataSource({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: 'saas_crm_test',
    });

    await ds.connect();

    // Drop and recreate test database
    await ds.query(`DROP DATABASE IF EXISTS saas_crm_test`);
    await ds.query(`CREATE DATABASE saas_crm_test`);
    await ds.close();

    console.log('✅ Test database created');
  } catch (error) {
    console.error('❌ Failed to create test database:', error.message);
    throw error;
  }

  // Run TypeORM migrations (synchronize will create tables from entities)
  console.log('📦 Tables will be created via TypeORM synchronize');
}
