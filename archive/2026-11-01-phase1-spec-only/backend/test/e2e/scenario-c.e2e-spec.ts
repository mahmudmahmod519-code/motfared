/**
 * E2E Tests - Scenario C: Lead Distribution (Primary/Secondary)
 * Flow: Create lead -> Create task -> Assign contacts to workers -> Primary/Secondary distribution
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { User, UserStatus } from '../../users/entities/user.entity';
import { Company, CompanyStatus } from '../../companies/entities/company.entity';
import { Lead } from '../../leads/entities/lead.entity';
import { LeadContact } from '../../lead-contacts/entities/lead-contact.entity';
import { PlanSales } from '../../plan-sales/entities/plan-sales.entity';
import { LeadItem } from '../../lead-items/entities/lead-item.entity';
import { LeadItemCallCenter } from '../../lead-item-call-centers/entities/lead-item-call-center.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('Scenario C - Lead Distribution (E2E)', () => {
  let app: INestApplication;
  let repos: {
    users: Repository<User>;
    companies: Repository<Company>;
    leads: Repository<Lead>;
    contacts: Repository<LeadContact>;
    tasks: Repository<PlanSales>;
    items: Repository<LeadItem>;
    assignments: Repository<LeadItemCallCenter>;
  };
  let crmToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    repos = {
      users: moduleFixture.get(getRepositoryToken(User)),
      companies: moduleFixture.get(getRepositoryToken(Company)),
      leads: moduleFixture.get(getRepositoryToken(Lead)),
      contacts: moduleFixture.get(getRepositoryToken(LeadContact)),
      tasks: moduleFixture.get(getRepositoryToken(PlanSales)),
      items: moduleFixture.get(getRepositoryToken(LeadItem)),
      assignments: moduleFixture.get(getRepositoryToken(LeadItemCallCenter)),
    };
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Setup company, CRM manager, call center workers, lead, task
    const company = await repos.companies.save({
      name: 'Scenario C Company',
      type_company: 'sales',
      status: CompanyStatus.ACTIVE,
    } as any);

    const crmManager = await repos.users.save({
      name: 'CRM Manager C',
      email: 'crmC@scenario.com',
      password_hash: 'hashed',
      company_id: company.id,
      platform_role: 'admin',
      status: UserStatus.ACTIVE,
    } as any);

    const worker1 = await repos.users.save({
      name: 'Worker 1',
      email: 'worker1@scenario.com',
      password_hash: 'hashed',
      company_id: company.id,
      platform_role: 'sales',
      status: UserStatus.ACTIVE,
    } as any);

    const worker2 = await repos.users.save({
      name: 'Worker 2',
      email: 'worker2@scenario.com',
      password_hash: 'hashed',
      company_id: company.id,
      platform_role: 'sales',
      status: UserStatus.ACTIVE,
    } as any);

    const lead = await repos.leads.save({
      name: 'Facebook Campaign',
      source_type: 'facebook_ads',
      company_id: company.id,
      is_active: true,
    } as any);

    const contact = await repos.contacts.save({
      company_id: company.id,
      lead_id: lead.id,
      name: 'Test Contact',
      phone: '+1234567890',
      status: 'new',
    } as any);

    const task = await repos.tasks.save({
      company_id: company.id,
      name: 'Distribution Task',
      created_by: crmManager.id,
      status: 'active',
      limit_calls: 10,
    } as any);

    const item = await repos.items.save({
      lead_id: lead.id,
      plan_sales_id: task.id,
      status: 'active',
    } as any);

    // Login as CRM manager
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'crmC@scenario.com', password: 'password123' })
      .expect(200);
    crmToken = loginRes.body.access_token;

    // Store IDs for use in tests
    (this as any).testData = { company, crmManager, worker1, worker2, lead, contact, task, item };
  });

  afterEach(async () => {
    await repos.assignments.delete({});
    await repos.items.delete({});
    await repos.tasks.delete({});
    await repos.contacts.delete({});
    await repos.leads.delete({});
    await repos.users.delete({});
    await repos.companies.delete({});
  });

  it('should assign primary worker to lead item', async () => {
    const { item, worker1 } = (this as any).testData;

    const response = await request(app.getHttpServer())
      .post('/api/lead-item-call-centers')
      .set('Cookie', [`access_token=${crmToken}`])
      .send({
        lead_item_id: item.id,
        user_id: worker1.id,
        assignment_role: 'primary',
        priority_order: 1,
        target_calls: 10,
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.assignment_role).toBe('primary');
    expect(response.body.user_id).toBe(worker1.id);
  });

  it('should assign secondary worker to same lead item', async () => {
    const { item, worker2 } = (this as any).testData;

    const response = await request(app.getHttpServer())
      .post('/api/lead-item-call-centers')
      .set('Cookie', [`access_token=${crmToken}`])
      .send({
        lead_item_id: item.id,
        user_id: worker2.id,
        assignment_role: 'secondary',
        priority_order: 1,
        target_calls: 5,
      })
      .expect(201);

    expect(response.body.assignment_role).toBe('secondary');
  });

  it('should prevent duplicate assignment (same worker, same lead item)', async () => {
    const { item, worker1 } = (this as any).testData;

    // First assignment
    await request(app.getHttpServer())
      .post('/api/lead-item-call-centers')
      .set('Cookie', [`access_token=${crmToken}`])
      .send({
        lead_item_id: item.id,
        user_id: worker1.id,
        assignment_role: 'primary',
        priority_order: 1,
      })
      .expect(201);

    // Duplicate should fail (depends on DB constraint)
    const response = await request(app.getHttpServer())
      .post('/api/lead-item-call-centers')
      .set('Cookie', [`access_token=${crmToken}`])
      .send({
        lead_item_id: item.id,
        user_id: worker1.id,
        assignment_role: 'primary',
        priority_order: 2,
      });

    // May return 409 or 500 depending on unique constraint implementation
    expect([409, 500]).toContain(response.status);
  });

  it('should retrieve assignments for a lead item', async () => {
    const { item } = (this as any).testData;

    const response = await request(app.getHttpServer())
      .get(`/api/lead-item-call-centers?lead_item_id=${item.id}`)
      .set('Cookie', [`access_token=${crmToken}`])
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });
});
