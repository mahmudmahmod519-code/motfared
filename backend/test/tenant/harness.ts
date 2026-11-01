/**
 * Shared bootstrap for integration specs under test/tenant (real app, real MySQL on :3307).
 * Env must be set before AppModule is imported, hence the side effects at module load.
 */
process.env.DB_HOST = process.env.TEST_DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.TEST_DB_PORT || '3307';
process.env.DB_USERNAME = 'saas_test';
process.env.DB_PASSWORD = 'saas_test';
process.env.DB_DATABASE = 'saas_test';
process.env.NODE_ENV = 'test';
// the tests must not depend on the developer's .env: no demo seed unless a test asks for one
process.env.SEED_DEMO_DATA = 'false';
process.env.JWT_SECRET = 'tenant-test-secret-0123456789abcdef0123456789';
// The schema comes from the real migrations (what production uses), not from TypeORM's synchronize:
// every run therefore also proves the migrations build a schema the entities agree with, and it avoids
// synchronize's occasional failure to find its own metadata table on a just-wiped database.
process.env.DB_SYNCHRONIZE = 'false';
process.env.DB_MIGRATIONS_RUN = 'true';
export const STRIPE_SECRET = 'whsec_test_0123456789abcdef0123456789abcdef';
export const PAYMOB_SECRET = 'paymob_test_hmac_0123456789abcdef0123456789abcdef';
process.env.STRIPE_WEBHOOK_SECRET = STRIPE_SECRET;
process.env.PAYMOB_HMAC_SECRET = PAYMOB_SECRET;

import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../../src/app.setup';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { Company, CompanyStatus } from '../../src/modules/companies/entities/company.entity';
import { User, UserStatus } from '../../src/modules/users/entities/user.entity';
import { CompanyMembership } from '../../src/modules/company-memberships/entities/company-membership.entity';
import { Plan } from '../../src/modules/plans/entities/plan.entity';
import { PlanPrice, PriceInterval } from '../../src/modules/plan-prices/entities/plan-price.entity';
import { Subscription, SubscriptionStatus } from '../../src/modules/subscriptions/entities/subscription.entity';

export const PASSWORD = 'Tenant#Test1';
export const DENIED = [400, 401, 403, 404];

/** Empties the scratch database before the app boots, so TypeORM never has to ALTER an older schema. */
export async function wipeDatabase() {
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await ds.initialize();
  await ds.dropDatabase();
  await ds.destroy();
}

export async function bootstrap(opts: { reset?: boolean; noThrottle?: boolean } = { reset: true }) {
  if (opts.reset) await wipeDatabase();
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (opts.noThrottle) process.env.THROTTLE_DISABLED = 'true';
  const mod = await builder.compile();
  const app: INestApplication = mod.createNestApplication<NestExpressApplication>({ rawBody: true });
  configureApp(app as NestExpressApplication); // the very same pipeline as main.ts
  await app.init();
  const db = app.get(DataSource);
  const http = () => request(app.getHttpServer());
  const tok: Record<string, string> = {};
  const as = (who: string) => ({ Authorization: `Bearer ${tok[who]}` });

  const mkUser = async (name: string, email: string, company_id: string | null, role?: string, platform_role?: string, extra: Record<string, any> = {}) => {
    const users = db.getRepository(User);
    const u = await users.save(
      users.create({ name, email, password_hash: await argon2.hash(PASSWORD), status: UserStatus.ACTIVE, company_id: company_id as any, platform_role, ...extra } as any),
    );
    if (company_id && role) await db.getRepository(CompanyMembership).save({ company_id, user_id: u.id, role } as any);
    return u;
  };
  const login = async (key: string, email: string) => {
    const res = await http().post('/api/auth/login').send({ email, password: PASSWORD });
    if (res.status >= 300) throw new Error(`login failed for ${email}: ${res.status}`);
    tok[key] = res.body.access_token;
  };
  /** Token for a user without going through /auth/login (which is rate limited). Identity only, like real tokens. */
  const tokenFor = (key: string, userId: string, email = 'x@t.test') => {
    tok[key] = app.get(JwtService, { strict: false }).sign({ sub: userId, email });
  };
  const mkCompany = (name: string) =>
    db.getRepository(Company).save(db.getRepository(Company).create({ name, status: CompanyStatus.ACTIVE }));

  /** Gives a company an active subscription (30 days left), so entitlement checks let its users work. */
  const subscribe = async (companyId: string) => {
    const plan = await db.getRepository(Plan).save({ name: 'Test plan', slug: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, is_active: true } as any);
    const price = await db.getRepository(PlanPrice).save({ plan_id: plan.id, amount: 100, currency: 'EGP', interval: PriceInterval.MONTH, is_active: true } as any);
    return db.getRepository(Subscription).save({
      company_id: companyId, plan_price_id: price.id, status: SubscriptionStatus.ACTIVE, starts_at: new Date(), current_period_end: new Date(Date.now() + 30 * 864e5),
    } as any);
  };

  return {
    app, db, http, tok, as, mkUser, login, tokenFor, mkCompany, subscribe,
    get: (who: string, url: string) => http().get(`/api${url}`).set(as(who)),
    post: (who: string, url: string, body: any = {}) => http().post(`/api${url}`).set(as(who)).send(body),
    patch: (who: string, url: string, body: any) => http().patch(`/api${url}`).set(as(who)).send(body),
    del: (who: string, url: string) => http().delete(`/api${url}`).set(as(who)),
  };
}
