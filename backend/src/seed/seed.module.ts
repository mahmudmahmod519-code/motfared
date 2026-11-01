import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { DomainDemoSeed } from './domain-demo.seed';
import { User } from '../modules/users/entities/user.entity';
import { Company } from '../modules/companies/entities/company.entity';
import { CompanyMembership } from '../modules/company-memberships/entities/company-membership.entity';
import { Lead } from '../modules/leads/entities/lead.entity';
import { LeadContact } from '../modules/lead-contacts/entities/lead-contact.entity';
import { Plan } from '../modules/plans/entities/plan.entity';
import { PlanPrice } from '../modules/plan-prices/entities/plan-price.entity';
import { Subscription } from '../modules/subscriptions/entities/subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Company,
      CompanyMembership,
      Lead,
      LeadContact,
      Plan,
      PlanPrice,
      Subscription,
    ]),
  ],
  providers: [SeedService, DomainDemoSeed],
  exports: [SeedService],
})
export class SeedModule {}
