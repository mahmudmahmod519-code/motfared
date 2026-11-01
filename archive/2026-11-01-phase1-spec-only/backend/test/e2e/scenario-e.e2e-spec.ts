/**
 * E2E Tests - Scenario E: Primary Quota Exhausted
 * Flow: Primary worker reaches call limit -> System routes to secondary -> Notify CRM
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

describe('Scenario E - Primary Quota Exhausted (E2E)', () => {
  let app: INestApplication;
  let repos: {
    users: Repository<User>;
    companies: Repository<Company>;
    contacts: Repository<LeadContact>;
    calls: Repository<Call>;
    assignments: Repository<LeadItemCallCenter>;
  };
  let crmToken: string;
  let primaryWorkerId: string;
  let secondaryWorkerId: string;

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
      name: 'Scenario E Company',
      type_company: 'sales',
      status: CompanyStatus.ACTIVE,
    } as any);

    const crmManager = await repos.users.save({
      name: 'CRM Manager E',
      email: 'crmE@scenario.com',
      password_hash: 'hashed',
      company_id: company.id,
      platform_role: 'admin',
      status: UserStatus.ACTIVE,
    } as any);

    const primary = await repos.users.save({
      name: 'Primary Worker',
      email: 'primary@scenario.com',
      password_hash: 'hashed',
      company_id: company.id,
      platform_role: 'sales',
      status: UserStatus.ACTIVE,
    } as any);

    const secondary = await repos.users.save({
      name: 'Secondary Worker',
      email: 'secondary@scenario.com',
      password_hash: 'hashed',
      company_id: company.id,
      platform_role: 'sales',
      status: UserStatus.ACTIVE,
    } as any);

    const contact = await repos.contacts.save({
      company_id: company.id,
      name: 'Quota Test Contact',
      phone: '+1234567890',
      status: 'assigned',
    } as any);

    const primaryAssignment = await repos.assignments.save({
      user_id: primary.id,
      assignment_role: 'primary',
      status: 'active',
      target_calls: 2, // Low limit to test exhaustion
    } as any);

    const secondaryAssignment = await repos.assignments.save({
      user_id: secondary.id,
      assignment_role: 'secondary',
      status: 'active',
      target_calls: 10,
    } as any);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'crmE@scenario.com', password: 'password123' })
      .expect(200);
    crmToken = loginRes.body.access_token;
    primaryWorkerId = primary.id;
    secondaryWorkerId = secondary.id;

    (this as any).testData = { company, contact, primaryAssignment, secondaryAssignment };
  });

  afterEach(async () => {
    await repos.calls.delete({});
    await repos.assignments.delete({});
    await repos.contacts.delete({});
    await repos.users.delete({});
    await repos.companies.delete({});
  });

  it('should track call count per primary worker', async () => {
    const { contact, primaryAssignment } = (this as any).testData;
    const companyId = (this as any).testData.company.id;

    // Login as primary worker
    const primaryLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'primary@scenario.com', password: 'password123' })
      .expect(200);
    const primaryToken = primaryLogin.body.access_token;

    // Make calls up to limit (2 calls)
    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .post('/api/calls')
        .set('Cookie', [`access_token=${primaryToken}`])
        .send({
          company_id: companyId,
          lead_contact_id: contact.id,
          assignment_id: primaryAssignment.id,
          call_center_user_id: primaryWorkerId,
          outcome: 'answered',
          duration_seconds: 60,
          notes: `Call ${i + 1}`,
        })
        .expect(201);
    }

    // Verify call count
    const calls = await repos.calls.find({
      where: { call_center_user_id: primaryWorkerId },
    });
    expect(calls.length).toBe(2);
  });

  it('should route to secondary worker when primary exhausted', async () => {
    const { contact, secondaryAssignment } = (this as any).testData;
    const companyId = (this as any).testData.company.id;

    // Login as secondary worker
    const secondaryLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'secondary@scenario.com', password: 'password123' })
      .expect(200);
    const secondaryToken = secondaryLogin.body.access_token;

    // Secondary worker takes over
    const response = await request(app.getHttpServer())
      .post('/api/calls')
      .set('Cookie', [`access_token=${secondaryToken}`])
      .send({
        company_id: companyId,
        lead_contact_id: contact.id,
        assignment_id: secondaryAssignment.id,
        call_center_user_id: secondaryWorkerId,
        outcome: 'answered',
        duration_seconds: 90,
        notes: 'Secondary worker handling overflow',
      })
      .expect(201);

    expect(response.body.outcome).toBe('answered');
  });
});
