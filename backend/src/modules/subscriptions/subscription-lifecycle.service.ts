import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { deriveState } from './entitlement';
import { EntitlementService } from './entitlement.service';

/**
 * Bookkeeping only: access is always derived on the fly (see deriveState), so the guard is
 * correct even if this never runs. The sweep keeps the stored status honest for reports and
 * admin lists. It never deletes anything.
 */
@Injectable()
export class SubscriptionLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Subscription) private readonly subs: Repository<Subscription>,
    private readonly entitlements: EntitlementService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const fallback = process.env.NODE_ENV === 'test' ? 0 : 3_600_000;
    const every = Number(this.config.get('SUBSCRIPTION_SWEEP_INTERVAL_MS', String(fallback)));
    if (every > 0) {
      this.timer = setInterval(() => this.expireOverdue().catch((e) => this.logger.error(e.message)), every);
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Returns the number of subscriptions whose stored status was brought up to date. */
  async expireOverdue(now = new Date()): Promise<number> {
    const open = await this.subs.find({ where: { status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE]) } });
    let changed = 0;
    for (const sub of open) {
      const { state } = deriveState(sub, 'active', now, this.entitlements.graceDays);
      if (state === 'expired') sub.status = SubscriptionStatus.EXPIRED;
      else if (state === 'cancelled') { sub.status = SubscriptionStatus.CANCELED; sub.canceled_at = sub.canceled_at ?? now; }
      else continue;
      await this.subs.save(sub);
      changed++;
    }
    if (changed) this.logger.log(`Updated ${changed} overdue subscription(s)`);
    return changed;
  }
}
