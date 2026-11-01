import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { Campaign } from '../domain/core/campaign.entity';
import { Doctor } from '../domain/core/doctor.entity';
import { Service } from '../domain/core/service.entity';
import { Team } from '../domain/core/team.entity';
import { CompanyMembership } from '../modules/company-memberships/entities/company-membership.entity';
import { Company } from '../modules/companies/entities/company.entity';
import { User, UserStatus } from '../modules/users/entities/user.entity';

/**
 * Demo content for the rebuilt schema (teams, clinics, campaigns, services) in the demo company, so the dashboard does
 * not open on empty pages. Only runs together with the rest of the demo seed (SEED_DEMO_DATA=true, never in production),
 * and only fills a company that has no teams yet, so a second start never duplicates anything.
 */
@Injectable()
export class DomainDemoSeed {
  private readonly logger = new Logger(DomainDemoSeed.name);

  constructor(private readonly ds: DataSource) {}

  async run() {
    const company = await this.ds.getRepository(Company).findOne({ where: { name: 'Al-Amal Specialized Clinic' } });
    if (!company) return;
    const companyId = company.id;
    if ((await this.ds.getRepository(Team).countBy({ company_id: companyId })) > 0) return;

    const teams = await this.ds.getRepository(Team).save(
      [['A', 'الفريق أ'], ['B', 'الفريق ب'], ['C', 'الفريق ج']].map(([code, name]) => ({ company_id: companyId, code, name })),
    );
    const team = Object.fromEntries(teams.map((t) => [t.code, t.id]));

    const doctorsInput = [
      { name: 'د. كريم نعيم', team: 'A', city: 'القاهرة', slug: 'karim-naim', phone: '01012345601', whatsapp: '01012345601', address: 'مدينة نصر، القاهرة', hours: 'السبت - الخميس، 4 م - 10 م' },
      { name: 'دكتورة منى جمال', team: 'B', city: 'الجيزة', slug: 'mona-gamal', phone: '01012345602', whatsapp: '01012345602', address: 'الدقي، الجيزة', hours: 'يوميًا، 12 م - 8 م' },
      { name: 'د. زياد كمال', team: 'C', city: 'الإسكندرية', slug: 'ziad-kamal', phone: '01012345603', whatsapp: '01012345603', address: 'سموحة، الإسكندرية', hours: 'السبت - الأربعاء، 3 م - 9 م' },
      { name: 'عيادة الجداوي', team: 'A', city: 'القاهرة', slug: 'elgedawy', phone: '01012345604', whatsapp: '01012345604', address: 'المعادي، القاهرة', hours: 'يوميًا، 2 م - 10 م' },
    ];
    for (const d of doctorsInput) {
      const doctor = await this.ds.getRepository(Doctor).save(
        this.ds.getRepository(Doctor).create({ company_id: companyId, name: d.name, team_id: team[d.team], city: d.city, slug: d.slug, phone: d.phone, whatsapp: d.whatsapp, address: d.address, hours: d.hours, active: true }),
      );
      for (const name of [`حملة ${d.name.replace(/^(د\.|دكتورة|عيادة)\s*/, '')} - إعلان فيسبوك`, 'حملة تيك توك']) {
        await this.ds.getRepository(Campaign).save(this.ds.getRepository(Campaign).create({ company_id: companyId, doctor_id: doctor.id, name }));
      }
    }

    await this.ds.getRepository(Service).save(
      ['تقويم أسنان', 'حشو', 'تنظيف وتلميع', 'تبييض أسنان', 'زراعة أسنان'].map((name) => ({ company_id: companyId, name, active: true })),
    );

    // A team lead confined to team A, to try the team scoping with.
    const hash = await argon2.hash('Password@123');
    const lead = await this.ds.getRepository(User).save(
      this.ds.getRepository(User).create({ name: 'Demo Team Lead', email: 'teamlead@clinic.com', password_hash: hash, phone: '+201111111150', status: UserStatus.ACTIVE, company_id: companyId }),
    );
    await this.ds.getRepository(CompanyMembership).save(
      this.ds.getRepository(CompanyMembership).create({ company_id: companyId, user_id: lead.id, role: 'team_lead', status: 'active' as any, team_id: team.A }),
    );
    this.logger.log('Demo clinics, campaigns, services and a team lead created for the rebuilt schema.');
  }
}
