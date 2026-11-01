import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly repo: Repository<Payment>,
  ) {}

  async create(dto: CreatePaymentDto) {
    if (dto.idempotency_key) {
      const existing = await this.repo.findOne({ where: { idempotency_key: dto.idempotency_key } });
      if (existing) {
        return existing;
      }
    }
    const payment = this.repo.create(dto);
    return this.repo.save(payment);
  }

  /** Payments belong to a company through their subscription. */
  async findAll(subscriptionId?: string, companyId?: string) {
    const where: any = {};
    if (subscriptionId) where.subscription_id = subscriptionId;
    if (companyId) where.subscription = { company_id: companyId };
    return this.repo.find({
      where,
      relations: ['subscription', 'subscription.company'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, companyId?: string) {
    const payment = await this.repo.findOne({
      where: companyId ? ({ id, subscription: { company_id: companyId } } as any) : { id },
      relations: ['subscription', 'subscription.company'],
    });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    return payment;
  }

  async updateStatus(id: string, status: PaymentStatus) {
    const payment = await this.findOne(id);
    payment.status = status;
    if (status === PaymentStatus.SUCCEEDED && !payment.paid_at) {
      payment.paid_at = new Date();
    }
    return this.repo.save(payment);
  }
}
