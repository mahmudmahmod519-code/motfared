import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { DomainDemoSeed } from './domain-demo.seed';
import { User, UserStatus } from '../modules/users/entities/user.entity';
import { Company, CompanyStatus } from '../modules/companies/entities/company.entity';
import { CompanyMembership } from '../modules/company-memberships/entities/company-membership.entity';
import { Lead } from '../modules/leads/entities/lead.entity';
import { LeadContact, LeadContactStatus } from '../modules/lead-contacts/entities/lead-contact.entity';
import { Plan } from '../modules/plans/entities/plan.entity';
import { PlanPrice, PriceInterval } from '../modules/plan-prices/entities/plan-price.entity';
import { Subscription, SubscriptionStatus } from '../modules/subscriptions/entities/subscription.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    @InjectRepository(CompanyMembership) private membershipRepo: Repository<CompanyMembership>,
    @InjectRepository(Lead) private leadRepo: Repository<Lead>,
    @InjectRepository(LeadContact) private contactRepo: Repository<LeadContact>,
    @InjectRepository(Plan) private planRepo: Repository<Plan>,
    @InjectRepository(PlanPrice) private priceRepo: Repository<PlanPrice>,
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    private readonly domainDemo: DomainDemoSeed,
  ) {}

  async onModuleInit() {
    // The seed creates a platform admin and demo accounts with well-known passwords, so it
    // only runs when explicitly requested and never in production.
    if (process.env.SEED_DEMO_DATA !== 'true' || process.env.NODE_ENV === 'production') {
      this.logger.log('Demo seed disabled (set SEED_DEMO_DATA=true outside production to enable).');
      return;
    }
    try {
      await this.seed();
      await this.domainDemo.run(); // idempotent: fills the rebuilt schema once
    } catch (err: any) {
      this.logger.error(`Seed error: ${err.message}`);
    }
  }

  async seed() {
    const adminExists = await this.userRepo.findOne({ where: { email: 'admin@platform.com' } });
    if (adminExists) {
      this.logger.log('Database already seeded. Skipping.');
      return;
    }

    this.logger.log('🌱 Seeding initial data per README spec...');

    const defaultPasswordHash = await argon2.hash('Admin@123');
    const userPasswordHash = await argon2.hash('Password@123');

    // 1. Super Admin
    const admin = await this.userRepo.save(
      this.userRepo.create({
        name: 'Platform Super Admin',
        email: 'admin@platform.com',
        password_hash: defaultPasswordHash,
        phone: '+201000000001',
        platform_role: 'platform_admin',
        status: UserStatus.ACTIVE,
      }),
    );

    // 2. SaaS Plans
    const proPlan = await this.planRepo.save(
      this.planRepo.create({
        name: 'Pro Business Plan',
        slug: 'pro-business',
        description: 'Comprehensive CRM and Lead Distribution package',
        features: {
          max_users: 20,
          max_lead_sources: 10,
          max_contacts_per_month: 10000,
          max_calls_per_month: 25000,
        },
        is_active: true,
      }),
    );

    const proPrice = await this.priceRepo.save(
      this.priceRepo.create({
        plan_id: proPlan.id,
        amount: 299.0,
        currency: 'EGP',
        interval: PriceInterval.MONTH,
        is_active: true,
      }),
    );

    // 3. Company 1 - Medical Clinic
    const ceo1 = await this.userRepo.save(
      this.userRepo.create({
        name: 'Dr. Tarek Clinic Owner',
        email: 'ceo1@clinic.com',
        password_hash: userPasswordHash,
        phone: '+201111111111',
        status: UserStatus.ACTIVE,
      }),
    );

    const comp1 = await this.companyRepo.save(
      this.companyRepo.create({
        name: 'Al-Amal Specialized Clinic',
        type_company: 'doctor',
        description: 'Dental and Specialized Health Clinic',
        client_label: 'Patient',
        call_center_label: 'Clinic Reception',
        crm_manager_label: 'Clinic Operations Manager',
        owner_user_id: ceo1.id,
        address: 'Nasr City, Cairo, Egypt',
        phone_whatsapp: '+201111111111',
        phone_telephone: '0223456789',
        status: CompanyStatus.ACTIVE,
      }),
    );

    ceo1.company_id = comp1.id;
    await this.userRepo.save(ceo1);

    await this.membershipRepo.save(
      this.membershipRepo.create({
        company_id: comp1.id,
        user_id: ceo1.id,
        role: 'owner',
        status: 'active' as any,
      }),
    );

    // Subscription for Company 1
    await this.subRepo.save(
      this.subRepo.create({
        company_id: comp1.id,
        plan_price_id: proPrice.id,
        status: SubscriptionStatus.ACTIVE,
        starts_at: new Date(),
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      }),
    );

    // CRM Manager for Company 1
    const crm1 = await this.userRepo.save(
      this.userRepo.create({
        name: 'Ahmed CRM Manager',
        email: 'crm1@clinic.com',
        password_hash: userPasswordHash,
        phone: '+201111111112',
        company_id: comp1.id,
        status: UserStatus.ACTIVE,
      }),
    );
    await this.membershipRepo.save(
      this.membershipRepo.create({
        company_id: comp1.id,
        user_id: crm1.id,
        role: 'admin',
        status: 'active' as any,
      }),
    );

    // 5 Call Center agents for Company 1
    for (let i = 1; i <= 5; i++) {
      const cc = await this.userRepo.save(
        this.userRepo.create({
          name: `Call Center Agent ${i} (Clinic)`,
          email: `agent${i}@clinic.com`,
          password_hash: userPasswordHash,
          phone: `+20111111110${i}`,
          company_id: comp1.id,
          status: UserStatus.ACTIVE,
        }),
      );
      await this.membershipRepo.save(
        this.membershipRepo.create({
          company_id: comp1.id,
          user_id: cc.id,
          role: 'sales',
          status: 'active' as any,
        }),
      );
    }

    // 4. Company 2 - Sales / Real Estate
    const ceo2 = await this.userRepo.save(
      this.userRepo.create({
        name: 'Mahmoud Real Estate CEO',
        email: 'ceo2@realty.com',
        password_hash: userPasswordHash,
        phone: '+201222222222',
        status: UserStatus.ACTIVE,
      }),
    );

    const comp2 = await this.companyRepo.save(
      this.companyRepo.create({
        name: 'Al-Nour Real Estate',
        type_company: 'sales',
        description: 'Commercial and Residential Real Estate Properties',
        client_label: 'Lead',
        call_center_label: 'Telesales Agent',
        crm_manager_label: 'Sales Director',
        owner_user_id: ceo2.id,
        address: 'New Cairo, Cairo, Egypt',
        phone_whatsapp: '+201222222222',
        status: CompanyStatus.ACTIVE,
      }),
    );

    ceo2.company_id = comp2.id;
    await this.userRepo.save(ceo2);

    await this.membershipRepo.save(
      this.membershipRepo.create({
        company_id: comp2.id,
        user_id: ceo2.id,
        role: 'owner',
        status: 'active' as any,
      }),
    );

    await this.subRepo.save(
      this.subRepo.create({
        company_id: comp2.id,
        plan_price_id: proPrice.id,
        status: SubscriptionStatus.ACTIVE,
        starts_at: new Date(),
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      }),
    );

    // CRM Manager for Company 2
    const crm2 = await this.userRepo.save(
      this.userRepo.create({
        name: 'Khaled Sales Manager',
        email: 'crm2@realty.com',
        password_hash: userPasswordHash,
        phone: '+201222222223',
        company_id: comp2.id,
        status: UserStatus.ACTIVE,
      }),
    );
    await this.membershipRepo.save(
      this.membershipRepo.create({
        company_id: comp2.id,
        user_id: crm2.id,
        role: 'admin',
        status: 'active' as any,
      }),
    );

    // 5 Call Center agents for Company 2
    for (let i = 1; i <= 5; i++) {
      const cc = await this.userRepo.save(
        this.userRepo.create({
          name: `Sales Agent ${i} (Realty)`,
          email: `agent${i}@realty.com`,
          password_hash: userPasswordHash,
          phone: `+20122222220${i}`,
          company_id: comp2.id,
          status: UserStatus.ACTIVE,
        }),
      );
      await this.membershipRepo.save(
        this.membershipRepo.create({
          company_id: comp2.id,
          user_id: cc.id,
          role: 'sales',
          status: 'active' as any,
        }),
      );
    }

    // 5. 10 Lead Sources (5 per company)
    const leadSources = [
      { name: 'Clinic Facebook Ads Ramadan', company_id: comp1.id, source_type: 'facebook_ads' },
      { name: 'Clinic Dental Checkup Google Form', company_id: comp1.id, source_type: 'google_form' },
      { name: 'Clinic Instagram Promotion', company_id: comp1.id, source_type: 'instagram_ads' },
      { name: 'Clinic Walk-in Inquiries', company_id: comp1.id, source_type: 'manual_import' },
      { name: 'Clinic Partner Referrals', company_id: comp1.id, source_type: 'manual_import' },
      { name: 'New Capital Villa Campaign', company_id: comp2.id, source_type: 'facebook_ads' },
      { name: 'North Coast Chalets Form', company_id: comp2.id, source_type: 'google_form' },
      { name: 'Commercial Offices Instagram', company_id: comp2.id, source_type: 'instagram_ads' },
      { name: 'Cityscape Expo Leads', company_id: comp2.id, source_type: 'manual_import' },
      { name: 'Website Direct Inquiries', company_id: comp2.id, source_type: 'google_form' },
    ];

    for (let idx = 0; idx < leadSources.length; idx++) {
      const ls = leadSources[idx];
      const clientPhone1 = `+20109999${idx}`;
      const clientPhone2 = `+20109999${idx + 10}`;
      const lead = await this.leadRepo.save(
        this.leadRepo.create({
          name: ls.name,
          company_id: ls.company_id,
          source_type: ls.source_type,
          is_active: true,
        }),
      );

      // Seed 2 contacts per lead
      await this.contactRepo.save([
        this.contactRepo.create({
          company_id: ls.company_id,
          lead_id: lead.id,
          external_row_id: `EXT-${lead.id}-1`,
          name: `Client 1 for ${lead.name}`,
          phone: clientPhone1,
          email: 'client1@example.com',
          status: LeadContactStatus.NEW,
        }),
        this.contactRepo.create({
          company_id: ls.company_id,
          lead_id: lead.id,
          external_row_id: `EXT-${lead.id}-2`,
          name: `Client 2 for ${lead.name}`,
          phone: clientPhone2,
          email: 'client2@example.com',
          status: LeadContactStatus.NEW,
        }),
      ]);
    }

    this.logger.log('✅ Seed completed successfully with all required users, companies, and leads!');
  }
}
