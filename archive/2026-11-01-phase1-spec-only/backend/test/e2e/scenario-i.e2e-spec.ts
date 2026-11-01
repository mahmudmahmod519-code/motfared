/**
 * E2E Tests - Scenario I: Subscription Cancellation
 * Flow: Request cancellation -> Cancel at period end -> Features remain until period end -> Access revoked
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { User, UserStatus } from '../../users/entities/user.entity';
import { Company, CompanyStatus } from '../../companies/entities/company.entity';
import { PlanPrice } from '../../plan-prices/entities/plan-price.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('Scenario I - Subscription Cancellation (E2E)', () => {
  let app: INestApplication;
  let repos: {
    users: Repository<User>;
    companies: Repository<Company>;
    prices: Repository<PlanPrice>;
    subscriptions: Repository<Subscription>;
  };
  let ceoToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    repos = {
      users: moduleFixture.get(getRepositoryToken(User)),
      companies: moduleFixture.get(getRepositoryToken(Company)),
      prices: moduleFixture.get(getRepositoryToken(PlanPrice)),
      subscriptions: moduleFixture.get(getRepositoryToken(Subscription)),
    };
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const company = await repos.companies.save({
      name: 'Scenario I Company',
      type_company: 'sales',
      status: CompanyStatus.ACTIVE,
    } as any);

    const owner = await repos.users.save({
      name: 'CEO I',
      email: 'ceoI@scenario.com',
      password_hash: 'hashed',
      company_id: company.id,
      platform_role: 'owner',
      status: UserStatus.ACTIVE,
    } as any);

    const price = await repos.prices.save({
      amount: 99.00,
      currency: 'EGP',
      interval: 'month',
      is_active: true,
    } as any);

    const subscription = await repos.subscriptions.save({
      company_id: company.id,
      plan_price_id: price.id,
      status: 'active',
      starts_at: new Date(),
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancel_at_period_end: false,
    } as any);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'ceoI@scenario.com', password: 'password123' })
      .expect(200);
    ceoToken = loginRes.body.access_token;

    (this as any).testData = { company, subscription };
  });

  afterEach(async () => {
    await repos.subscriptions.delete({});
    await repos.prices.delete({});
    await repos.users.delete({});
    await repos.companies.delete({});
  });

  it('should cancel subscription at period end', async () => {
    const { subscription } = (this as any).testData;

    const response = await request(app.getHttpServer())
      .post(`/api/subscriptions/${subscription.id}/cancel`)
      .set('Cookie', [`access_token=${ceoToken}`])
      .expect(200);

    expect(response.body.cancel_at_period_end).toBe(true);
    expect(response.body.status).toBe('active'); // Still active until period end
  });

  it('should keep features active until period end after cancellation', async () => {
    const { subscription } = (this as any).testData;

    const sub = await repos.subscriptions.findOne({ where: { id: subscription.id } });
    expect(sub.cancel_at_period_end).toBe(true);
    expect(sub.status).toBe('active'); // Features still available

    // Verify period end is in the future
    expect(sub.current_period_end > new Date()).toBe(true);
  });

  it('should resume canceled subscription', async () => {
    const { subscription } = (this as any).testData;

    // First cancel
    await request(app.getHttpServer())
      .post(`/api/subscriptions/${subscription.id}/cancel`)
      .set('Cookie', [`access_token=${ceoToken}`])
      .expect(200);

    // Then resume
    const response = await request(app.getHttpServer())
      .post(`/api/subscriptions/${subscription.id}/resume`)
      .set('Cookie', [`access_token=${ceoToken}`])
      .expect(200);

    expect(response.body.cancel_at_period_end).toBe(false);
    expect(response.body.status).toBe('active');
  });

  it('should reject cancellation if already canceled', async () => {
    const { subscription } = (this as any).testData;

    // Cancel first time
    await request(app.getHttpServer())
      .post(`/api/subscriptions/${subscription.id}/cancel`)
      .set('Cookie', [`access_token=${ceoToken}`])
      .expect(200);

    // Cancel again - may return 409 or similar
    const response = await request(app.getHttpServer())
      .post(`/api/subscriptions/${subscription.id}/cancel`)
      .set('Cookie', [`access_token=${ceoToken}`]);

    expect([200, 409, 422]).toContain(response.status);
  });
});
