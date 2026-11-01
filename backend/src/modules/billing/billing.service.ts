import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ManualPaymentRequest, ManualPaymentStatus } from './entities/manual-payment-request.entity';
import { PlanPrice } from '../plan-prices/entities/plan-price.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { SubscriptionActivationService } from '../subscriptions/subscription-activation.service';
import { CreateManualPaymentRequestDto } from './dto/create-manual-payment-request.dto';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(ManualPaymentRequest) private readonly repo: Repository<ManualPaymentRequest>,
    @InjectRepository(PlanPrice) private readonly prices: Repository<PlanPrice>,
    private readonly activation: SubscriptionActivationService,
  ) {}

  /** Company, amount and currency come from the verified principal and our own price row. */
  async create(companyId: string, userId: string, dto: CreateManualPaymentRequestDto) {
    const price = await this.prices.findOne({ where: { id: dto.plan_price_id } });
    if (!price || !price.is_active) throw new BadRequestException('Unknown or inactive plan price');
    const reference = dto.reference.trim();
    try {
      return await this.repo.save(
        this.repo.create({
          company_id: companyId,
          plan_price_id: price.id,
          requested_by: userId,
          reference,
          reference_key: reference.toLowerCase(),
          payer_phone: dto.payer_phone,
          note: dto.note,
          receipt_reference: dto.receipt_reference,
          expected_amount: price.amount,
          currency: price.currency,
          status: ManualPaymentStatus.PENDING_VERIFICATION,
        }),
      );
    } catch (e: any) {
      if ((e?.code ?? e?.driverError?.code) === 'ER_DUP_ENTRY') {
        throw new ConflictException('This payment reference has already been submitted');
      }
      throw e;
    }
  }

  /** `companyId` undefined = platform admin (all companies). */
  findAll(companyId?: string, status?: ManualPaymentStatus) {
    const where: any = {};
    if (companyId) where.company_id = companyId;
    if (status) where.status = status;
    return this.repo.find({ where, order: { created_at: 'DESC' } });
  }

  async findOne(id: string, companyId?: string) {
    const r = await this.repo.findOne({ where: companyId ? { id, company_id: companyId } : { id } });
    if (!r) throw new NotFoundException(`Payment request ${id} not found`);
    return r;
  }

  /**
   * Admin decision. The request row is locked, so concurrent or repeated decisions
   * cannot activate twice; a decided request is a 409.
   */
  async approve(id: string, adminId: string, note?: string) {
    return this.repo.manager.transaction(async (m) => {
      const req = await this.lock(m, id);
      const price = await m.findOneOrFail(PlanPrice, { where: { id: req.plan_price_id } });

      // The company's current (not cancelled/expired) subscription is extended; otherwise a new one is created.
      let sub = await m.findOne(Subscription, {
        where: { company_id: req.company_id, status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE, SubscriptionStatus.UNPAID, SubscriptionStatus.INCOMPLETE]) },
        order: { created_at: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!sub) {
        sub = await m.save(Subscription, m.create(Subscription, { company_id: req.company_id, plan_price_id: price.id, status: SubscriptionStatus.INCOMPLETE, starts_at: new Date() }));
      }

      const paidAt = new Date();
      const payment = await m.save(
        Payment,
        m.create(Payment, {
          subscription_id: sub.id,
          provider: 'instapay',
          provider_payment_id: req.reference,
          amount: req.expected_amount,
          currency: req.currency,
          status: PaymentStatus.SUCCEEDED,
          paid_at: paidAt,
          idempotency_key: `manual:${req.id}`,
        }),
      );
      await this.activation.activateForPayment(m, sub, price, paidAt);

      req.status = ManualPaymentStatus.APPROVED;
      req.reviewed_by = adminId;
      req.reviewed_at = paidAt;
      req.review_note = note ?? null;
      req.subscription_id = sub.id;
      req.payment_id = payment.id;
      return m.save(ManualPaymentRequest, req);
    });
  }

  async reject(id: string, adminId: string, note: string) {
    if (!note?.trim()) throw new BadRequestException('A rejection note is required');
    return this.repo.manager.transaction(async (m) => {
      const req = await this.lock(m, id);
      req.status = ManualPaymentStatus.REJECTED;
      req.reviewed_by = adminId;
      req.reviewed_at = new Date();
      req.review_note = note.trim();
      return m.save(ManualPaymentRequest, req);
    });
  }

  private async lock(m: import('typeorm').EntityManager, id: string) {
    const req = await m.findOne(ManualPaymentRequest, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!req) throw new NotFoundException(`Payment request ${id} not found`);
    if (req.status !== ManualPaymentStatus.PENDING_VERIFICATION) {
      throw new ConflictException(`Request already ${req.status}`);
    }
    return req;
  }
}
