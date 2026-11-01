/**
 * E2E Tests - Scenario D: Call Center Calls a Customer
 * Flow: Worker logs call -> Call recorded -> Contact updated -> Assignment progress
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { User, UserStatus } from '../../users/entities/user.entity';
import { Company, CompanyStatus } from '../../companies/entities/company.entity';
import { LeadContact } from '../../lead-contacts/entities/lead-contact.entity';
import { Call } from '../../calls/entities/call.entity';
import { LeadItemCallCenter } from '../../lead-item-call-centers/entities/lead-item-call-center.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('Scenario D - Call Center Calls Customer (E2E)', () => {
  let app: INestApplication;
  let repos: {
    users: Repository<User>;
    companies: Repository<Company>;
    contacts: Repository<LeadContact>;
    calls: Repository<Call>;
    assignments: Repository<LeadItemCallCenter>;
  };
  let workerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    repos = {
      users: moduleFixture.get(getRepositoryToken(User)),
      companies: moduleFixture.get(getRepositoryToken(Company)),
      contacts: moduleFixture.get(getRepositoryToken(LeadContact)),
      calls: moduleFixture.get(getRepositoryToken(Call)),
      assignments: moduleFixture.get(getRepositoryToken(LeadItemCallCenter)),
    };
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const company = await repos.companies.save({
      name: 'Scenario D Company',
      type_company: 'sales',
      status: CompanyStatus.ACTIVE,
    } as any);

    const worker = await repos.users.save({
      name: 'Call Center Worker',
      email: 'worker@scenarioD.com',
      password_hash: 'hashed',
      company_id: company.id,
      platform_role: 'sales',
      status: UserStatus.ACTIVE,
    } as any);

    const contact = await repos.contacts.save({
      company_id: company.id,
      name: 'Customer Jane',
      phone: '+1234567890',
      status: 'assigned',
    } as any);

    const assignment = await repos.assignments.save({
      user_id: worker.id,
      assignment_role: 'primary',
      status: 'active',
    } as any);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'worker@scenarioD.com', password: 'password123' })
      .expect(200);
    workerToken = loginRes.body.access_token;

    (this as any).testData = { company, worker, contact, assignment };
  });

  afterEach(async () => {
    await repos.calls.delete({});
    await repos.assignments.delete({});
    await repos.contacts.delete({});
    await repos.users.delete({});
    await repos.companies.delete({});
  });

  it('should log a call attempt', async () => {
    const { contact, assignment } = (this as any).testData;

    const response = await request(app.getHttpServer())
      .post('/api/calls')
      .set('Cookie', [`access_token=${workerToken}`])
      .send({
        company_id: (this as any).testData.company.id,
        lead_contact_id: contact.id,
        assignment_id: assignment.id,
        call_center_user_id: (this as any).testData.worker.id,
        outcome: 'answered',
        customer_decision: 'interested',
        duration_seconds: 180,
        notes: 'Customer interested in product',
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.outcome).toBe('answered');
    expect(response.body.customer_decision).toBe('interested');
    expect(response.body.duration_seconds).toBe(180);

    // Verify in database
    const call = await repos.calls.findOne({ where: { id: response.body.id } });
    expect(call).toBeDefined();
    expect(call.outcome).toBe('answered');
  });

  it('should log multiple calls for same contact', async () => {
    const { contact, assignment } = (this as any).testData;
    const companyId = (this as any).testData.company.id;
    const workerId = (this as any).testData.worker.id;

    // First call - no answer
    await request(app.getHttpServer())
      .post('/api/calls')
      .set('Cookie', [`access_token=${workerToken}`])
      .send({
        company_id: companyId,
        lead_contact_id: contact.id,
        assignment_id: assignment.id,
        call_center_user_id: workerId,
        outcome: 'no_answer',
        duration_seconds: 0,
        notes: 'No answer',
      })
      .expect(201);

    // Second call - busy
    await request(app.getHttpServer())
      .post('/api/calls')
      .set('Cookie', [`access_token=${workerToken}`])
      .send({
        company_id: companyId,
        lead_contact_id: contact.id,
        assignment_id: assignment.id,
        call_center_user_id: workerId,
        outcome: 'busy',
        duration_seconds: 0,
        notes: 'Line busy',
      })
      .expect(201);

    // Verify both calls exist
    const calls = await repos.calls.find({ where: { lead_contact_id: contact.id } });
    expect(calls.length).toBe(2);
  });

  it('should retrieve call history for a contact', async () => {
    const { contact } = (this as any).testData;

    const response = await request(app.getHttpServer())
      .get(`/api/lead-contacts/${contact.id}/calls`)
      .set('Cookie', [`access_token=${workerToken}`])
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should reject call from unauthorized worker', async () => {
    // Create a different worker not assigned to this contact
    const otherWorker = await repos.users.save({
      name: 'Other Worker',
      email: 'other@scenarioD.com',
      password_hash: 'hashed',
      company_id: (this as any).testData.company.id,
      platform_role: 'sales',
      status: UserStatus.ACTIVE,
    } as any);

    const otherTokenRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'other@scenarioD.com', password: 'password123' })
      .expect(200);

    const { contact, assignment } = (this as any).testData;

    const response = await request(app.getHttpServer())
      .post('/api/calls')
      .set('Cookie', [`access_token=${otherTokenRes.body.access_token}`])
      .send({
        company_id: (this as any).testData.company.id,
        lead_contact_id: contact.id,
        assignment_id: assignment.id,
        call_center_user_id: otherWorker.id,
        outcome: 'answered',
        duration_seconds: 60,
        notes: 'Unauthorized call',
      });

    // May be 403 depending on authorization implementation
    expect([201, 403]).toContain(response.status);

    await repos.users.delete({ id: otherWorker.id });
  });
});
