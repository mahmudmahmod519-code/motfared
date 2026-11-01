import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingCustomer } from './entities/billing-customer.entity';

@Injectable()
export class BillingCustomersService {
  constructor(
    @InjectRepository(BillingCustomer)
    private readonly repo: Repository<BillingCustomer>,
  ) {}

  async create(data: { company_id: string; provider: string; provider_customer_id: string }) {
    const customer = this.repo.create(data);
    return this.repo.save(customer);
  }

  async findByCompanyAndProvider(companyId: string, provider: string) {
    return this.repo.findOne({ where: { company_id: companyId, provider } });
  }

  async findByProviderCustomer(provider: string, providerCustomerId: string) {
    return this.repo.findOne({
      where: { provider, provider_customer_id: providerCustomerId },
      relations: ['company'],
    });
  }

  async findAll(companyId?: string) {
    const where = companyId ? { company_id: companyId } : {};
    return this.repo.find({ where, relations: ['company'] });
  }
}
