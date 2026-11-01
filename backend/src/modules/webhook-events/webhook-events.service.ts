import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { WebhookEvent } from './entities/webhook-event.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { SubscriptionProviderRef } from '../subscription-provider-refs/entities/subscription-provider-ref.entity';
import { SubscriptionActivationService } from '../subscriptions/subscription-activation.service';

type Outcome = string | void; // a note => processed but deliberately not applied (mismatch, ignored, stale…)

const isDuplicateKey = (e: any) => (e?.code ?? e?.driverError?.code) === 'ER_DUP_ENTRY';
const upper = (s?: string) => (s || '').toUpperCase();

/**
 * Processes provider events that the controller has already authenticated (signature/HMAC).
 *
 * - Every event is logged once (unique provider+event id) and processed under a row lock,
 *   so duplicate or concurrent deliveries are applied exactly once.
 * - Each event is applied in one transaction; on failure nothing is applied, the error is
 *   recorded and a 500 makes the provider retry.
 * - Amounts/currencies are checked against our own price/payment rows; a mismatch never
 *   activates anything and is acknowledged (a retry cannot fix it) with a note for review.
 * - Out-of-order delivery: status changes only apply if the event is not older than the
 *   newest one already applied to that subscription; payments are always recorded.
 */
@Injectable()
export class WebhookEventsService {
  private readonly logger = new Logger(WebhookEventsService.name);

  constructor(
    @InjectRepository(WebhookEvent) private readonly repo: Repository<WebhookEvent>,
    private readonly activation: SubscriptionActivationService,
  ) {}

  // ───────────────────────────── plumbing ─────────────────────────────
  private async run(provider: string, eventId: string, type: string, payload: any, apply: (m: EntityManager) => Promise<Outcome>) {
    try {
      await this.repo.insert({ provider, provider_event_id: eventId, event_type: type, payload, received_at: new Date() });
    } catch (e) {
      if (!isDuplicateKey(e)) throw e;
    }
    try {
      return await this.repo.manager.transaction(async (m) => {
        const ev = await m.findOneOrFail(WebhookEvent, {
          where: { provider, provider_event_id: eventId },
          lock: { mode: 'pessimistic_write' },
        });
        if (ev.processed) return { received: true, duplicate: true };
        const note = await apply(m);
        ev.processed = true;
        ev.processed_at = new Date();
        ev.processing_error = note || null;
        await m.save(WebhookEvent, ev);
        return { received: true };
      });
    } catch (err: any) {
      this.logger.error(`Error processing ${provider} event ${eventId}: ${err.message}`);
      await this.repo.update({ provider, provider_event_id: eventId }, { processing_error: String(err.message).slice(0, 1000) });
      throw new InternalServerErrorException('Event processing failed'); // provider will retry
    }
  }

  private async lockSubscription(m: EntityManager, id: string) {
    return m.findOne(Subscription, { where: { id }, relations: ['plan_price'], lock: { mode: 'pessimistic_write' } });
  }

  // ───────────────────────────── Stripe ─────────────────────────────
  async handleStripeEvent(event: any) {
    return this.run('stripe', event.id, event.type, event, (m) => this.applyStripe(m, event));
  }

  private async applyStripe(m: EntityManager, event: any): Promise<Outcome> {
    const obj = event.data?.object ?? {};
    const eventAt = new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000);

    switch (event.type) {
      case 'checkout.session.completed': {
        // Links the provider subscription to ours (client_reference_id). Never activates by itself.
        const ourId = obj.client_reference_id;
        if (!ourId || !obj.subscription) return 'ignored: checkout session without subscription link';
        const sub = await m.findOne(Subscription, { where: { id: ourId } });
        if (!sub) return 'ignored: unknown subscription reference';
        const existing = await m.findOne(SubscriptionProviderRef, { where: { provider: 'stripe', provider_subscription_id: obj.subscription } });
        if (!existing) {
          await m.save(SubscriptionProviderRef, m.create(SubscriptionProviderRef, { subscription_id: sub.id, provider: 'stripe', provider_subscription_id: obj.subscription }));
        }
        return;
      }

      case 'invoice.payment_succeeded':
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const ref = obj.subscription ? await this.refFor(m, 'stripe', obj.subscription) : null;
        if (!ref) return 'ignored: unknown provider subscription';
        const sub = await this.lockSubscription(m, ref.subscription_id);
        if (!sub) return 'ignored: subscription missing';
        const fresh = this.isFresh(ref, eventAt);

        if (event.type === 'invoice.payment_failed') {
          await this.recordPayment(m, sub, `stripe:invoice:${obj.id}:failed`, {
            provider: 'stripe', provider_payment_id: obj.payment_intent, provider_invoice_id: obj.id,
            amount: (obj.amount_due ?? 0) / 100, currency: upper(obj.currency) || sub.plan_price?.currency, status: PaymentStatus.FAILED,
          });
          if (fresh && (sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.TRIALING)) {
            sub.status = SubscriptionStatus.PAST_DUE;
            await m.save(Subscription, sub);
          }
          await this.touch(m, ref, eventAt);
          return;
        }

        const price = sub.plan_price;
        const paid = (obj.amount_paid ?? 0) / 100;
        if (!price || upper(obj.currency) !== upper(price.currency) || Math.round(paid * 100) !== Math.round(Number(price.amount) * 100)) {
          return `mismatch: paid ${paid} ${upper(obj.currency)} but plan price is ${price?.amount} ${price?.currency}; not activated`;
        }
        await this.recordPayment(m, sub, `stripe:invoice:${obj.id}`, {
          provider: 'stripe', provider_payment_id: obj.payment_intent, provider_invoice_id: obj.id,
          amount: paid, currency: upper(obj.currency), status: PaymentStatus.SUCCEEDED, paid_at: new Date(),
        });
        if (fresh) { // a verified, amount-checked payment also reactivates an expired subscription
          const period = obj.lines?.data?.[0]?.period ?? { start: obj.period_start, end: obj.period_end };
          const end = new Date(period.end * 1000);
          sub.status = SubscriptionStatus.ACTIVE;
          if (!sub.current_period_end || end > sub.current_period_end) {
            sub.current_period_start = new Date(period.start * 1000);
            sub.current_period_end = end;
          }
          sub.canceled_at = null;
          await m.save(Subscription, sub);
        }
        await this.touch(m, ref, eventAt);
        return;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const ref = await this.refFor(m, 'stripe', obj.id);
        if (!ref) return 'ignored: unknown provider subscription';
        const sub = await this.lockSubscription(m, ref.subscription_id);
        if (!sub) return 'ignored: subscription missing';
        if (!this.isFresh(ref, eventAt)) return 'stale: newer event already applied';

        if (event.type === 'customer.subscription.deleted' || obj.status === 'canceled') {
          sub.status = SubscriptionStatus.CANCELED;
          sub.canceled_at = sub.canceled_at ?? new Date();
        } else if (obj.status === 'past_due' && sub.status === SubscriptionStatus.ACTIVE) {
          sub.status = SubscriptionStatus.PAST_DUE;
        } else if (obj.status === 'unpaid' && sub.status !== SubscriptionStatus.CANCELED) {
          sub.status = SubscriptionStatus.UNPAID;
        } else if (obj.status === 'trialing' && sub.status === SubscriptionStatus.INCOMPLETE && obj.trial_end) {
          sub.status = SubscriptionStatus.TRIALING;
          sub.trial_ends_at = new Date(obj.trial_end * 1000);
        } // 'active' is granted by a verified, amount-checked paid invoice, never by this event
        if (typeof obj.cancel_at_period_end === 'boolean') sub.cancel_at_period_end = obj.cancel_at_period_end;
        await m.save(Subscription, sub);
        await this.touch(m, ref, eventAt);
        return;
      }

      default:
        return `ignored: unhandled event type ${event.type}`;
    }
  }

  private refFor(m: EntityManager, provider: string, providerSubId: string) {
    return m.findOne(SubscriptionProviderRef, { where: { provider, provider_subscription_id: providerSubId } });
  }
  private isFresh(ref: SubscriptionProviderRef, eventAt: Date) {
    return !ref.last_event_at || eventAt.getTime() >= ref.last_event_at.getTime();
  }
  private async touch(m: EntityManager, ref: SubscriptionProviderRef, eventAt: Date) {
    if (!ref.last_event_at || eventAt > ref.last_event_at) {
      ref.last_event_at = eventAt;
      await m.save(SubscriptionProviderRef, ref);
    }
  }
  private async recordPayment(m: EntityManager, sub: Subscription, key: string, data: Partial<Payment>) {
    const existing = await m.findOne(Payment, { where: { idempotency_key: key } });
    if (existing) return existing;
    return m.save(Payment, m.create(Payment, { ...data, subscription_id: sub.id, idempotency_key: key }));
  }

  // ───────────────────────────── Paymob ─────────────────────────────
  async handlePaymobEvent(obj: any) {
    const state = obj.is_refunded ? 'refunded' : obj.is_voided ? 'voided' : obj.pending ? 'pending' : obj.success ? 'success' : 'failed';
    // One transaction can call back several times (paid, then refunded): key on id + state.
    return this.run('paymob', `${obj.id}:${state}`, 'TRANSACTION', { obj }, (m) => this.applyPaymob(m, obj, state));
  }

  private async applyPaymob(m: EntityManager, obj: any, state: string): Promise<Outcome> {
    const orderId = obj.order?.id != null ? String(obj.order.id) : null;
    if (!orderId) return 'ignored: callback without order id';
    const payment = await m.findOne(Payment, { where: { provider: 'paymob', provider_payment_id: orderId }, lock: { mode: 'pessimistic_write' } });
    if (!payment) return 'ignored: no payment for this order';
    if (state === 'pending') return 'ignored: transaction still pending';

    if (state === 'refunded' || state === 'voided') {
      // Money went back: record it. Revoking access is a deliberate admin decision, not automatic.
      payment.status = payment.status === PaymentStatus.SUCCEEDED ? PaymentStatus.REFUNDED : PaymentStatus.FAILED;
      await m.save(Payment, payment);
      return `${state}: payment marked ${payment.status}; review the subscription manually`;
    }
    if (payment.status !== PaymentStatus.PENDING) return `ignored: payment already ${payment.status}`;

    if (state === 'failed') {
      payment.status = PaymentStatus.FAILED;
      await m.save(Payment, payment);
      return;
    }

    if (obj.error_occured || Math.round(Number(obj.amount_cents)) !== Math.round(Number(payment.amount) * 100) || upper(obj.currency) !== upper(payment.currency)) {
      return `mismatch: callback ${obj.amount_cents} ${upper(obj.currency)} vs expected ${Math.round(Number(payment.amount) * 100)} ${upper(payment.currency)}; not activated`;
    }
    const sub = await this.lockSubscription(m, payment.subscription_id);
    if (!sub?.plan_price) return 'ignored: subscription or price missing';
    payment.status = PaymentStatus.SUCCEEDED;
    payment.paid_at = new Date();
    payment.provider_invoice_id = String(obj.id);
    await m.save(Payment, payment);
    await this.activation.activateForPayment(m, sub, sub.plan_price, payment.paid_at);
  }

  async findAll() {
    return this.repo.find({ order: { received_at: 'DESC' }, take: 100 });
  }
}
