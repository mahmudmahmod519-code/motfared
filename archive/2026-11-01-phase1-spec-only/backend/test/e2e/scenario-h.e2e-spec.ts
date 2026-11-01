/**
 * E2E Tests - Scenario H: Subscription Renewal
 * Flow: Subscription expires -> Renewal attempted -> Payment -> Period extended
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { User, UserStatus } from '../../users/entities/user.entity';
import { Company, CompanyStatus } from '../../companies/entities/company.entity';
import { PlanPrice } from '../../plan-prices/entities/plan-price.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('Scenario H - Subscription Renewal (E2E)', () => {
  let app: INestApplication;
  let repos: {
    users: Repository<User>;
    companies: Repository<Company>;
    prices: Repository<PlanPrice>;
    subscriptions: Repository<Subscription>;
    payments: Repository<Payment>;
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
      payments: moduleFixture.get(getRepositoryToken(Payment)),
    };
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const company = await repos.companies.save({
      name: 'Scenario H Company',
      type_company: 'sales',
      status: CompanyStatus.ACTIVE,
    } as any);

    const owner = await repos.users.save({
      name: 'CEO H',
      email: 'ceoH@scenario.com',
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
      starts_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Started 30 days ago
      current_period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      current_period_end: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Expired yesterday
      cancel_at_period_end: false,
    } as any);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'ceoH@scenario.com', password: 'password123' })
      .expect(200);
    ceoToken = loginRes.body.access_token;

    (this as any).testData = { company, price, subscription };
  });

  afterEach(async () => {
    await repos.payments.delete({});
    await repos.subscriptions.delete({});
    await repos.prices.delete({});
    await repos.users.delete({});
    await repos.companies.delete({});
  });

  it('should detect expired subscription', async () => {
    const { subscription } = (this as any).testData;

    const sub = await repos.subscriptions.findOne({ where: { id: subscription.id } });
    expect(sub.status).toBe('active');
    expect(sub.current_period_end < new Date()).toBe(true); // Expired
  });

  it('should process renewal payment', async () => {
    const { subscription } = (this as any).testData;

    const paymentResponse = await request(app.getHttpServer())
      .post('/api/payments')
      .set('Cookie', [`access_token=${ceoToken}`])
      .send({
        subscription_id: subscription.id,
        provider: 'stripe',
        amount: 99.00,
        currency: 'EGP',
        idempotency_key: 'idem-renewal-001',
      })
      .expect(201);

    expect(paymentResponse.body.status).toBe('succeeded');
  });

  it('should extend subscription period after renewal', async () => {
    const { subscription } = (this as any).testData;

    const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const updateRes = await request(app.getHttpServer())
      .put(`/api/subscriptions/${subscription.id}`)
      .set('Cookie', [`access_token=${ceoToken}`])
      .send({
        status: 'active',
        current_period_end: newPeriodEnd.toISOString(),
      })
      .expect(200);

    expect(updateRes.body.status).toBe('active');

    const updated = await repos.subscriptions.findOne({ where: { id: subscription.id } });
    expect(updated.current_period_end > new Date()).toBe(true);
  });
});
