/**
 * Unit Tests - Dashboard Service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardService } from './dashboard.service';
import { Company } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { Lead } from '../leads/entities/lead.entity';
import { LeadContact } from '../lead-contacts/entities/lead-contact.entity';
import { Call } from '../calls/entities/call.entity';
import { PlanSales } from '../plan-sales/entities/plan-sales.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Payment } from '../payments/entities/payment.entity';

describe('DashboardService', () => {
  let service: DashboardService;
  let repos: {
    companies: Repository<Company>;
    users: Repository<User>;
    leads: Repository<Lead>;
    contacts: Repository<LeadContact>;
    calls: Repository<Call>;
    tasks: Repository<PlanSales>;
    subscriptions: Repository<Subscription>;
    payments: Repository<Payment>;
  };

  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Company), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(Lead), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(LeadContact), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(Call), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(PlanSales), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(Subscription), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(Payment), useValue: { count: jest.fn() } },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    repos = {
      companies: module.get(getRepositoryToken(Company)),
      users: module.get(getRepositoryToken(User)),
      leads: module.get(getRepositoryToken(Lead)),
      contacts: module.get(getRepositoryToken(LeadContact)),
      calls: module.get(getRepositoryToken(Call)),
      tasks: module.get(getRepositoryToken(PlanSales)),
      subscriptions: module.get(getRepositoryToken(Subscription)),
      payments: module.get(getRepositoryToken(Payment)),
    };
    jest.clearAllMocks();
  });

  describe('getGlobalStats', () => {
    it('should return global dashboard stats', async () => {
      repos.companies.count.mockResolvedValue(10);
      repos.users.count.mockResolvedValue(50);
      repos.leads.count.mockResolvedValue(100);
      repos.contacts.count.mockResolvedValue(500);
      repos.calls.count.mockResolvedValue(1000);
      repos.subscriptions.count.mockResolvedValue(8);
      repos.payments.count.mockResolvedValue(15);

      const stats = await service.getGlobalStats();

      expect(stats.totalCompanies).toBe(10);
      expect(stats.totalUsers).toBe(50);
      expect(stats.totalLeads).toBe(100);
      expect(stats.totalContacts).toBe(500);
      expect(stats.totalCalls).toBe(1000);
    });
  });

  describe('getCompanyStats', () => {
    it('should return company-specific stats', async () => {
      const companyId = 'test-company-id';
      repos.leads.count.mockResolvedValue(20);
      repos.contacts.count.mockResolvedValue(100);
      repos.calls.count.mockResolvedValue(200);
      repos.tasks.count.mockResolvedValue(5);

      const stats = await service.getCompanyStats(companyId);

      expect(stats.totalLeads).toBe(20);
      expect(stats.totalContacts).toBe(100);
      expect(stats.totalCalls).toBe(200);
      expect(stats.totalTasks).toBe(5);
    });
  });
});
