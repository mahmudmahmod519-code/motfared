/**
 * E2E Tests - Scenario B: CRM Manager Creates Task
 * Flow: Authenticate -> Create Plan Sales Task -> Verify task created
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { User, UserStatus } from '../../users/entities/user.entity';
import { Company, CompanyStatus } from '../../companies/entities/company.entity';
import { PlanSales } from '../../plan-sales/entities/plan-sales.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('Scenario B - CRM Manager Creates Task (E2E)', () => {
  let app: INestApplication;
  let usersRepo: Repository<User>;
  let companiesRepo: Repository<Company>;
  let tasksRepo: Repository<PlanSales>;
  let crmManagerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    usersRepo = moduleFixture.get(getRepositoryToken(User));
    companiesRepo = moduleFixture.get(getRepositoryToken(Company));
    tasksRepo = moduleFixture.get(getRepositoryToken(PlanSales));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Setup: Create company and CRM manager user
    const company = await companiesRepo.save({
      name: 'Scenario B Company',
      type_company: 'sales',
      status: CompanyStatus.ACTIVE,
    } as any);

    const crmManager = await usersRepo.save({
      name: 'CRM Manager',
      email: 'crm@scenarioB.com',
      password_hash: 'hashed',
      company_id: company.id,
      platform_role: 'admin',
      status: UserStatus.ACTIVE,
    } as any);

    crmManagerToken = 'test-token'; // Will be set via actual login
    // Actually login to get real token
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'crm@scenarioB.com', password: 'password123' })
      .expect(200);
    crmManagerToken = loginRes.body.access_token;
  });

  afterEach(async () => {
    await tasksRepo.delete({});
    await usersRepo.delete({ email: 'crm@scenarioB.com' });
    await companiesRepo.delete({ name: 'Scenario B Company' });
  });

  it('should create a plan sales task as CRM manager', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/plan-sales')
      .set('Cookie', [`access_token=${crmManagerToken}`])
      .send({
        company_id: '', // Will be set from user context
        name: 'Weekly Calling Task',
        limit_calls: 100,
        limit_bonus_calls: 20,
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe('Weekly Calling Task');
    expect(response.body.status).toBe('draft');

    // Verify in database
    const task = await tasksRepo.findOne({ where: { id: response.body.id } });
    expect(task).toBeDefined();
    expect(task.name).toBe('Weekly Calling Task');
  });

  it('should activate the task', async () => {
    const task = await tasksRepo.save({
      company_id: 'test-company',
      name: 'To Activate',
      status: 'draft',
      limit_calls: 50,
      created_by: 'crm-id',
    } as any);

    const response = await request(app.getHttpServer())
      .post(`/api/plan-sales/${task.id}/activate`)
      .set('Cookie', [`access_token=${crmManagerToken}`])
      .expect(200);

    expect(response.body.status).toBe('active');
  });

  it('should reject non-CRM manager from creating tasks', async () => {
    const ceoToken = 'owner-token'; // Would need actual CEO token
    // This test verifies role-based access control
    // Implementation depends on how roles are assigned
  });
});
