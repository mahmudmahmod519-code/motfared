import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { join } from 'path';
import { Doctor } from './modules/doctors/entities/doctor.entity';
import { UserDoctor } from './modules/doctors/entities/user-doctor.entity';
import { DoctorMessage } from './modules/doctors/entities/doctor-message.entity';
import { MessageTemplate } from './modules/message-templates/entities/message-template.entity';
import { CallLogEntry } from './modules/call-log/entities/call-log-entry.entity';
import { Permission } from './modules/rbac/entities/permission.entity';
import { Role } from './modules/rbac/entities/role.entity';
import { RolePermission } from './modules/rbac/entities/role-permission.entity';
import { RbacModule } from './modules/rbac/rbac.module';
import { DOMAIN_ENTITIES } from './domain/entities';
import { ClinicsModule } from './features/clinics/clinics.module';
import { CallResult } from './modules/call-results/entities/call-result.entity';
import { CompanySetting } from './modules/company-settings/entities/company-setting.entity';
import { EntitlementModule } from './modules/subscriptions/entitlement.module';
import { TenantModule } from './common/tenant/tenant.module';

// Entities
import { Company } from './modules/companies/entities/company.entity';
import { User } from './modules/users/entities/user.entity';
import { CompanyMembership } from './modules/company-memberships/entities/company-membership.entity';
import { Lead } from './modules/leads/entities/lead.entity';
import { LeadContact } from './modules/lead-contacts/entities/lead-contact.entity';
import { PlanSales } from './modules/plan-sales/entities/plan-sales.entity';
import { LeadItem } from './modules/lead-items/entities/lead-item.entity';
import { LeadItemCallCenter } from './modules/lead-item-call-centers/entities/lead-item-call-center.entity';
import { Call } from './modules/calls/entities/call.entity';
import { Service } from './modules/services/entities/service.entity';
import { Plan } from './modules/plans/entities/plan.entity';
import { PlanPrice } from './modules/plan-prices/entities/plan-price.entity';
import { Subscription } from './modules/subscriptions/entities/subscription.entity';
import { BillingCustomer } from './modules/billing-customers/entities/billing-customer.entity';
import { SubscriptionProviderRef } from './modules/subscription-provider-refs/entities/subscription-provider-ref.entity';
import { Payment } from './modules/payments/entities/payment.entity';
import { WebhookEvent } from './modules/webhook-events/entities/webhook-event.entity';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CompanyMembershipsModule } from './modules/company-memberships/company-memberships.module';
import { ServicesModule } from './modules/services/services.module';
import { PlansModule } from './modules/plans/plans.module';
import { PlanPricesModule } from './modules/plan-prices/plan-prices.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { BillingCustomersModule } from './modules/billing-customers/billing-customers.module';
import { SubscriptionProviderRefsModule } from './modules/subscription-provider-refs/subscription-provider-refs.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MobileModule } from './modules/mobile/mobile.module';
import { BillingModule } from './modules/billing/billing.module';
import { ManualPaymentRequest } from './modules/billing/entities/manual-payment-request.entity';
import { WebhookEventsModule } from './modules/webhook-events/webhook-events.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SeedModule } from './seed/seed.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SensitiveDataInterceptor } from './common/interceptors/sensitive-data.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
      // Test hook only; ignored in production.
      skipIf: () => process.env.THROTTLE_DISABLED === 'true' && process.env.NODE_ENV !== 'production',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: parseInt(config.get('DB_PORT', '3306')),
        username: config.get('DB_USERNAME', 'saas_user'),
        password: config.get('DB_PASSWORD', 'saas_pass'),
        database: config.get('DB_DATABASE', 'saas_crm'),
        entities: [
          Company,
          User,
          CompanyMembership,
          Lead,
          LeadContact,
          PlanSales,
          LeadItem,
          LeadItemCallCenter,
          Call,
          Service,
          Plan,
          PlanPrice,
          Subscription,
          BillingCustomer,
          SubscriptionProviderRef,
          Payment,
          WebhookEvent,
          ManualPaymentRequest,
          Doctor,
          UserDoctor,
          CallResult,
          CompanySetting,
          DoctorMessage,
          MessageTemplate,
          CallLogEntry,
          Permission,
          Role,
          RolePermission,
          ...DOMAIN_ENTITIES,
        ],
        // Schema is managed by migrations in production; auto-sync is a dev/test convenience only.
        synchronize: process.env.NODE_ENV !== 'production' && config.get('DB_SYNCHRONIZE') !== 'false',
        logging: config.get('NODE_ENV') === 'development',
        // Migrations never run implicitly against a live DB; opt in with DB_MIGRATIONS_RUN=true or `npm run migration:run`.
        migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
        migrationsRun: config.get('DB_MIGRATIONS_RUN') === 'true',
        charset: 'utf8mb4',
        // Dates are read and written as UTC whatever the server's own timezone is (day boundaries are
        // computed on the Cairo calendar from the instant, never from a shifted wall time).
        timezone: 'Z',
      }),
    }),
    TenantModule,
    EntitlementModule,
    RbacModule,
    ClinicsModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    CompanyMembershipsModule,
    ServicesModule,
    PlansModule,
    PlanPricesModule,
    SubscriptionsModule,
    BillingCustomersModule,
    SubscriptionProviderRefsModule,
    PaymentsModule,
    WebhookEventsModule,
    BillingModule,
    MobileModule,
    DashboardModule,
    SeedModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SensitiveDataInterceptor },
  ],
})
export class AppModule {}
