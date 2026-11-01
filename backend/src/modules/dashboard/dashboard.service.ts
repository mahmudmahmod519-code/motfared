import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { Lead } from '../leads/entities/lead.entity';
import { LeadContact } from '../lead-contacts/entities/lead-contact.entity';
import { Call, CallOutcome } from '../calls/entities/call.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { PlanSales } from '../plan-sales/entities/plan-sales.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Lead) private leadRepo: Repository<Lead>,
    @InjectRepository(LeadContact) private contactRepo: Repository<LeadContact>,
    @InjectRepository(Call) private callRepo: Repository<Call>,
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    @InjectRepository(Payment) private payRepo: Repository<Payment>,
    @InjectRepository(PlanSales) private planSalesRepo: Repository<PlanSales>,
  ) {}

  async getAdminStats() {
    const totalCompanies = await this.companyRepo.count();
    const totalUsers = await this.userRepo.count();
    const totalSubscriptions = await this.subRepo.count();
    const activeSubscriptions = await this.subRepo.count({ where: { status: 'active' as any } });

    const payments = await this.payRepo.find({ where: { status: PaymentStatus.SUCCEEDED } });
    const totalRevenue = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

    return {
      totalCompanies,
      totalUsers,
      totalSubscriptions,
      activeSubscriptions,
      totalRevenue,
    };
  }

  async getCompanyStats(companyId: string) {
    const totalLeads = await this.leadRepo.count({ where: { company_id: companyId } });
    const totalContacts = await this.contactRepo.count({ where: { company_id: companyId } });
    const totalCalls = await this.callRepo.count({ where: { company_id: companyId } });
    const answeredCalls = await this.callRepo.count({
      where: { company_id: companyId, outcome: CallOutcome.ANSWERED },
    });
    const totalTasks = await this.planSalesRepo.count({ where: { company_id: companyId } });

    return {
      totalLeads,
      totalContacts,
      totalCalls,
      answeredCalls,
      totalTasks,
    };
  }

  async getCallCenterStats(companyId: string, userId: string) {
    const totalCalls = await this.callRepo.count({
      where: { company_id: companyId, call_center_user_id: userId },
    });
    const answeredCalls = await this.callRepo.count({
      where: {
        company_id: companyId,
        call_center_user_id: userId,
        outcome: CallOutcome.ANSWERED,
      },
    });

    return {
      totalCalls,
      answeredCalls,
    };
  }
}
