import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly repo: Repository<Subscription>,
  ) {}

  /** Platform-admin only at the controller: a tenant must never write its own entitlement. */
  async create(dto: CreateSubscriptionDto) {
    if (!dto.starts_at) {
      dto.starts_at = new Date().toISOString();
    }
    const sub = this.repo.create(dto);
    return this.repo.save(sub);
  }

  async findAll(companyId?: string) {
    const where = companyId ? { company_id: companyId } : {};
    return this.repo.find({
      where,
      relations: ['company', 'plan_price', 'plan_price.plan', 'payments', 'provider_refs'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, companyId?: string) {
    const sub = await this.repo.findOne({
      where: companyId ? { id, company_id: companyId } : { id },
      relations: ['company', 'plan_price', 'plan_price.plan', 'payments', 'provider_refs'],
    });
    if (!sub) throw new NotFoundException(`Subscription ${id} not found`);
    return sub;
  }

  async findCurrentByCompany(companyId: string) {
    return this.repo.findOne({
      where: { company_id: companyId, status: SubscriptionStatus.ACTIVE },
      relations: ['plan_price', 'plan_price.plan'],
      order: { created_at: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    await this.findOne(id);
    const { company_id: _ignored, ...changes } = dto as any;
    await this.repo.update(id, changes);
    return this.findOne(id);
  }

  async cancel(id: string, atPeriodEnd: boolean = true, companyId?: string) {
    const sub = await this.findOne(id, companyId);
    if (atPeriodEnd) {
      sub.cancel_at_period_end = true;
    } else {
      sub.status = SubscriptionStatus.CANCELED;
      sub.canceled_at = new Date();
    }
    return this.repo.save(sub);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Subscription deleted' };
  }
}
