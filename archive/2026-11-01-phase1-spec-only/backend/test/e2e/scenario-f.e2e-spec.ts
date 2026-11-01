/**
 * E2E Tests - Scenario F: Google Sheets Sync
 * Flow: Connect Google Sheet -> Sync leads -> Verify contacts created -> Idempotent re-sync
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { User, UserStatus } from '../../users/entities/user.entity';
import { Company, CompanyStatus } from '../../companies/entities/company.entity';
import { Lead } from '../../leads/entities/lead.entity';
import { LeadContact } from '../../lead-contacts/entities/lead-contact.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('Scenario F - Google Sheets Sync (E2E)', () => {
  let app: INestApplication;
  let repos: {
    users: Repository<User>;
    companies: Repository<Company>;
    leads: Repository<Lead>;
    contacts: Repository<LeadContact>;
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
    };
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const company = await repos.companies.save({
      name: 'Scenario F Company',
      type_company: 'sales',
      status: CompanyStatus.ACTIVE,
    } as any);

    const crmManager = await repos.users.save({
      name: 'CRM Manager F',
      email: 'crmF@scenario.com',
      password_hash: 'hashed',
      company_id: company.id,
      platform_role: 'admin',
      status: UserStatus.ACTIVE,
    } as any);

    const lead = await repos.leads.save({
      name: 'Google Sheet Lead Source',
      source_type: 'google_form',
      company_id: company.id,
      google_sheet_id: 'test-sheet-id',
      google_sheet_tab: 'Sheet1',
      is_active: true,
    } as any);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'crmF@scenario.com', password: 'password123' })
      .expect(200);
    crmToken = loginRes.body.access_token;

    (this as any).testData = { company, lead };
  });

  afterEach(async () => {
    await repos.contacts.delete({});
    await repos.leads.delete({});
    await repos.users.delete({});
    await repos.companies.delete({});
  });

  it('should create a lead source with Google Sheet config', async () => {
    const { lead } = (this as any).testData;

    expect(lead.google_sheet_id).toBe('test-sheet-id');
    expect(lead.google_sheet_tab).toBe('Sheet1');
    expect(lead.source_type).toBe('google_form');
  });

  it('should trigger Google Sheets sync', async () => {
    const { lead } = (this as any).testData;

    const response = await request(app.getHttpServer())
      .post(`/api/leads/${lead.id}/sync`)
      .set('Cookie', [`access_token=${crmToken}`])
      .expect(202); // Accepted - queued job

    expect(response.body.job_id).toBeDefined();
    expect(response.body.status).toBe('queued');
  });

  it('should upsert contacts idempotently (no duplicates on re-sync)', async () => {
    const { lead } = (this as any).testData;
    const companyId = (this as any).testData.company.id;

    // Create initial contacts
    await repos.contacts.save([
      {
        company_id: companyId,
        lead_id: lead.id,
        external_row_id: 'row-1',
        name: 'Existing Contact 1',
        phone: '+1111111111',
        status: 'new',
      },
      {
        company_id: companyId,
        lead_id: lead.id,
        external_row_id: 'row-2',
        name: 'Existing Contact 2',
        phone: '+2222222222',
        status: 'new',
      },
    ] as any);

    const initialCount = await repos.contacts.count({
      where: { lead_id: lead.id },
    });
    expect(initialCount).toBe(2);

    // Re-sync with same external_row_ids - should not create duplicates
    // This tests idempotent upsert behavior
    const upsertResponse = await request(app.getHttpServer())
      .post('/api/lead-contacts/upsert')
      .set('Cookie', [`access_token=${crmToken}`])
      .send([
        {
          company_id: companyId,
          lead_id: lead.id,
          external_row_id: 'row-1', // Same as existing
          name: 'Updated Contact 1',
          phone: '+1111111111',
          status: 'queued',
        },
        {
          company_id: companyId,
          lead_id: lead.id,
          external_row_id: 'row-3', // New contact
          name: 'New Contact 3',
          phone: '+3333333333',
          status: 'new',
        },
      ])
      .expect(201);

    // Verify count - should be 3 (2 updated + 1 new), not 4
    const finalCount = await repos.contacts.count({
      where: { lead_id: lead.id },
    });
    expect(finalCount).toBe(3);

    // Verify contact 1 was updated, not duplicated
    const contact1 = await repos.contacts.findOne({
      where: { external_row_id: 'row-1' },
    });
    expect(contact1.name).toBe('Updated Contact 1');
  });
});
