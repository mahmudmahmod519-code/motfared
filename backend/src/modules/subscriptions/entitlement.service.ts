import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { Subscription } from './entities/subscription.entity';
import { EntitlementState, STATE_RANK, allowedFor, deriveState } from './entitlement';

export interface Entitlement {
  state: EntitlementState;
  code?: string;
  /** `work` = read && write: the single flag clients use for "operational access". */
  allowed: { read: boolean; write: boolean; billing: boolean; work: boolean };
  /** True when the role may read but not write because the subscription has lapsed (the owner's read-only mode). */
  read_only: boolean;
  grace_until?: Date;
  subscription_id?: string;
  current_period_end?: Date;
  trial_ends_at?: Date;
  cancel_at_period_end?: boolean;
  plan?: { name?: string; interval?: string; amount?: number; currency?: string; plan_price_id?: string };
}

@Injectable()
export class EntitlementService {
  constructor(
    @InjectRepository(Subscription) private readonly subs: Repository<Subscription>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    private readonly config: ConfigService,
  ) {}

  get graceDays(): number {
    const n = Number(this.config.get('SUBSCRIPTION_GRACE_DAYS', '3'));
    return Number.isFinite(n) && n >= 0 ? n : 3;
  }

  /** `role` is the caller's membership role: the owner keeps read-only access when the subscription has lapsed. */
  async resolve(companyId: string | null | undefined, role?: string | null, now = new Date()): Promise<Entitlement> {
    if (!companyId) return this.build({ state: 'none' }, role); // never let "no company" match some company
    const company = await this.companies.findOne({ where: { id: companyId }, select: { id: true, status: true } });
    if (!company) return this.build({ state: 'none' }, role);
    const rows = await this.subs.find({ where: { company_id: companyId }, relations: ['plan_price', 'plan_price.plan'] });

    let best: { state: EntitlementState; graceUntil?: Date; sub?: Subscription } = deriveState(null, company.status, now, this.graceDays);
    if (best.state !== 'suspended') {
      for (const sub of rows) {
        const d = deriveState(sub, company.status, now, this.graceDays);
        if (best.state === 'none' || STATE_RANK.indexOf(d.state) < STATE_RANK.indexOf(best.state)) best = { ...d, sub };
      }
    }
    return this.build(best, role);
  }

  private build(d: { state: EntitlementState; graceUntil?: Date; sub?: Subscription }, role?: string | null): Entitlement {
    const { sub } = d;
    const allowed = allowedFor(d.state, role);
    return {
      state: d.state,
      allowed: { ...allowed, work: allowed.read && allowed.write },
      read_only: allowed.read && !allowed.write,
      grace_until: d.graceUntil,
      subscription_id: sub?.id,
      current_period_end: sub?.current_period_end ?? undefined,
      trial_ends_at: sub?.trial_ends_at ?? undefined,
      cancel_at_period_end: sub?.cancel_at_period_end,
      plan: sub?.plan_price
        ? {
            plan_price_id: sub.plan_price.id,
            name: sub.plan_price.plan?.name,
            interval: sub.plan_price.interval,
            amount: Number(sub.plan_price.amount),
            currency: sub.plan_price.currency,
          }
        : undefined,
    };
  }
}
