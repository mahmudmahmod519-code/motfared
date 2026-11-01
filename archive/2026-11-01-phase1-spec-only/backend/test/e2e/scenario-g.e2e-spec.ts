/**
 * E2E Tests - Scenario G: Company Subscribes to SaaS
 * Flow: Select plan -> Create subscription -> Payment processed -> Features unlocked
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { User, UserStatus } from '../../users/entities/user.entity';
import { Company, CompanyStatus } from '../../companies/entities/company.entity';
import { Plan } from '../../plans/entities/plan.entity';
import { PlanPrice } from '../../plan-prices/entities/plan-price.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('Scenario G - Company Subscribes to SaaS (E2E)', () => {
  let app: INestApplication;
  let repos: {
    users: Repository<User>;
    companies: Repository<Company>;
    plans: Repository<Plan>;
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
      plans: moduleFixture.get(getRepositoryToken(Plan)),
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
      name: 'Scenario G Company',
      type_company: 'sales',
      status: CompanyStatus.PENDING,
    } as any);

    const owner = await repos.users.save({
      name: 'CEO G',
      email: 'ceoG@scenario.com',
      password_hash: 'hashed',
      company_id: company.id,
      platform_role: 'owner',
      status: UserStatus.ACTIVE,
    } as any);

    const plan = await repos.plans.save({
      name: 'Pro Plan',
      slug: 'pro',
      description: 'Professional plan',
      features: { max_users: 10, max_lead_sources: 5, max_contacts_per_month: 5000 },
      is_active: true,
    } as any);

    const price = await repos.prices.save({
      plan_id: plan.id,
      amount: 99.00,
      currency: 'EGP',
      interval: 'month',
      is_active: true,
    } as any);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'ceoG@scenario.com', password: 'password123' })
      .expect(200);
    ceoToken = loginRes.body.access_token;

    (this as any).testData = { company, plan, price };
  });

  afterEach(async () => {
    await repos.payments.delete({});
    await repos.subscriptions.delete({});
    await repos.prices.delete({});
    await repos.plans.delete({});
    await repos.users.delete({});
    await repos.companies.delete({});
  });

  it('should create a subscription', async () => {
    const { price } = (this as any).testData;

    const response = await request(app.getHttpServer())
      .post('/api/subscriptions')
      .set('Cookie', [`access_token=${ceoToken}`])
      .send({
        company_id: (this as any).testData.company.id,
        plan_price_id: price.id,
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.status).toBe('incomplete');
    expect(response.body.plan_price_id).toBe(price.id);

    // Verify in database
    const sub = await repos.subscriptions.findOne({ where: { id: response.body.id } });
    expect(sub).toBeDefined();
    expect(sub.status).toBe('incomplete');
  });

  it('should record a payment for the subscription', async () => {
    const { price } = (this as any).testData;

    // First create subscription
    const subRes = await request(app.getHttpServer())
      .post('/api/subscriptions')
      .set('Cookie', [`access_token=${ceoToken}`])
      .send({
        company_id: (this as any).testData.company.id,
        plan_price_id: price.id,
      })
      .expect(201);

    // Record payment
    const paymentResponse = await request(app.getHttpServer())
      .post('/api/payments')
      .set('Cookie', [`access_token=${ceoToken}`])
      .send({
        subscription_id: subRes.body.id,
        provider: 'stripe',
        amount: 99.00,
        currency: 'EGP',
        idempotency_key: 'idem-sub-001',
      })
      .expect(201);

    expect(paymentResponse.body.id).toBeDefined();
    expect(paymentResponse.body.status).toBe('succeeded');
    expect(paymentResponse.body.amount).toBe(99.00);

    // Verify idempotency - duplicate key should fail
    const dupResponse = await request(app.getHttpServer())
      .post('/api/payments')
      .set('Cookie', [`access_token=${ceoToken}`])
      .send({
        subscription_id: subRes.body.id,
        provider: 'stripe',
        amount: 99.00,
        currency: 'EGP',
        idempotency_key: 'idem-sub-001', // Same key
      });

    expect([409, 500]).toContain(dupResponse.status);
  });

  it('should check entitlement limits', async () => {
    const { company } = (this as any).testData;

    const response = await request(app.getHttpServer())
      .get(`/api/entitlement/check?company_id=${company.id}&feature=max_users&limit_type=user`)
      .set('Cookie', [`access_token=${ceoToken}`])
      .expect(200);

    expect(response.body.allowed).toBeDefined();
    expect(response.body.current_usage).toBeDefined();
    expect(response.body.limit).toBeDefined();
  });
});
