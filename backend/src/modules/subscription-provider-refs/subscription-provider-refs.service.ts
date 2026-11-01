import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionProviderRef } from './entities/subscription-provider-ref.entity';

@Injectable()
export class SubscriptionProviderRefsService {
  constructor(
    @InjectRepository(SubscriptionProviderRef)
    private readonly repo: Repository<SubscriptionProviderRef>,
  ) {}

  async create(data: Partial<SubscriptionProviderRef>) {
    const ref = this.repo.create(data);
    return this.repo.save(ref);
  }

  async findByProviderSubId(provider: string, subId: string) {
    return this.repo.findOne({
      where: { provider, provider_subscription_id: subId },
      relations: ['subscription', 'subscription.company'],
    });
  }

  async findAll(subscriptionId?: string) {
    const where = subscriptionId ? { subscription_id: subscriptionId } : {};
    return this.repo.find({ where, relations: ['subscription'] });
  }
}
