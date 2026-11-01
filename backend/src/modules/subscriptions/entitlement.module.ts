import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { Company } from '../companies/entities/company.entity';
import { EntitlementService } from './entitlement.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

/** Global so the SubscriptionGuard can be used by any controller without per-module wiring. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Company])],
  providers: [EntitlementService, SubscriptionLifecycleService],
  exports: [EntitlementService, SubscriptionLifecycleService],
})
export class EntitlementModule {}
