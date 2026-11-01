import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { PlanPrice, PriceInterval } from '../plan-prices/entities/plan-price.entity';

/**
 * The single place that turns a verified payment into paid access. Callers (webhook
 * handlers, manual-payment approval) must have verified the payment first; this never
 * looks at anything the client sent.
 */
@Injectable()
export class SubscriptionActivationService {
  addInterval(from: Date, interval: PriceInterval): Date {
    const d = new Date(from.getTime());
    if (interval === PriceInterval.YEAR) d.setUTCFullYear(d.getUTCFullYear() + 1);
    else d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  }

  /**
   * Activates or extends `sub` by one billing period of `price`. If the subscription is
   * still paid up, the new period starts when the current one ends (no lost days, no
   * double extension for the same moment); the period end never moves backwards.
   */
  async activateForPayment(m: EntityManager, sub: Subscription, price: PlanPrice, paidAt = new Date()): Promise<Subscription> {
    const stillRunning =
      (sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.TRIALING) &&
      sub.current_period_end && sub.current_period_end.getTime() > paidAt.getTime();
    const start = stillRunning ? sub.current_period_end : paidAt;
    const end = this.addInterval(start, price.interval);

    sub.status = SubscriptionStatus.ACTIVE;
    sub.plan_price_id = price.id;
    sub.current_period_start = start;
    sub.current_period_end = sub.current_period_end && sub.current_period_end > end ? sub.current_period_end : end;
    sub.canceled_at = null;
    return m.save(Subscription, sub);
  }
}
