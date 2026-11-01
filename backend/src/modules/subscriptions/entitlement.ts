import { Subscription, SubscriptionStatus } from './entities/subscription.entity';

/**
 * Subscription lifecycle as the product sees it, derived on every request from the stored
 * subscription, the company status and the clock. The backend is the only authority; no
 * client-supplied value takes part.
 *
 *  - `reactivated` (spec) is not a separate state: a verified payment on an expired/cancelled
 *    subscription simply makes it `active` again on the very next request.
 *  - `past_due` is the grace window after a missed period end (or a provider-reported failed
 *    payment). Access continues; the response carries the deadline.
 */
export type EntitlementState =
  | 'trial' | 'active' | 'past_due' | 'payment_pending' | 'payment_failed' | 'expired' | 'cancelled' | 'suspended' | 'none';

export type EntitlementClass = 'read' | 'write' | 'billing';

/**
 * Entitlement matrix. `read`/`write` cover everything operational (lead fetching and
 * claiming, customers, calls, imports, team management, dashboards); `billing` covers
 * viewing/paying for the subscription and the company profile. Login, /auth/me and
 * /subscriptions/status are never blocked, so a restricted user can always see why and pay.
 * Restricted states are all-or-nothing for working roles; the only half-open mode is the owner's read-only
 * access when lapsed (see allowedFor and OWNER_READ_ONLY_STATES).
 */
export const ENTITLEMENTS: Record<EntitlementState, Record<EntitlementClass, boolean>> = {
  trial: { read: true, write: true, billing: true },
  active: { read: true, write: true, billing: true },
  past_due: { read: true, write: true, billing: true },
  payment_pending: { read: false, write: false, billing: true },
  payment_failed: { read: false, write: false, billing: true },
  expired: { read: false, write: false, billing: true },
  cancelled: { read: false, write: false, billing: true },
  none: { read: false, write: false, billing: true },
  suspended: { read: false, write: false, billing: false },
};

/** The membership role of a company's owner (CEO). */
export const OWNER_ROLE = 'owner';

/**
 * Lapsed states in which the company OWNER keeps read-only access to the company's data, so a lapsed
 * subscription never locks the owner out of their own records (decision C-3, Nov 2026). Everyone else is
 * blocked from lead operations in these states; writes stay blocked for the owner too; billing stays open.
 * `payment_pending`/`none` (nothing has been paid or created yet) and `suspended` (a platform decision) give
 * the owner nothing extra.
 */
export const OWNER_READ_ONLY_STATES: EntitlementState[] = ['expired', 'cancelled', 'payment_failed'];

/** What a given membership role may do in a given state: the base matrix, plus read-only for the owner when lapsed. */
export function allowedFor(state: EntitlementState, role?: string | null): Record<EntitlementClass, boolean> {
  const base = ENTITLEMENTS[state];
  if (role === OWNER_ROLE && OWNER_READ_ONLY_STATES.includes(state)) return { ...base, read: true };
  return { ...base };
}

/** Stable machine-readable codes the web and mobile clients switch on. */
export const RESTRICTION: Partial<Record<EntitlementState, { code: string; status: number; message: string }>> = {
  none: { code: 'SUBSCRIPTION_REQUIRED', status: 402, message: 'This company has no subscription. Subscribe to continue.' },
  payment_pending: { code: 'PAYMENT_PENDING', status: 402, message: 'Your payment is awaiting verification.' },
  payment_failed: { code: 'PAYMENT_FAILED', status: 402, message: 'Your last payment failed. Update your payment to continue.' },
  cancelled: { code: 'SUBSCRIPTION_CANCELLED', status: 402, message: 'Your subscription was cancelled. Resubscribe to continue.' },
  expired: { code: 'SUBSCRIPTION_EXPIRED', status: 402, message: 'Your subscription has expired. Renew to continue.' },
  suspended: { code: 'COMPANY_SUSPENDED', status: 403, message: 'This company account is suspended. Contact support.' },
};

export interface DerivedState {
  state: EntitlementState;
  graceUntil?: Date;
}

const DAY = 864e5;

export function deriveState(
  sub: Pick<Subscription, 'status' | 'current_period_end' | 'trial_ends_at' | 'cancel_at_period_end' | 'updated_at'> | null,
  companyStatus: string | undefined,
  now: Date,
  graceDays: number,
): DerivedState {
  if (companyStatus === 'suspended' || companyStatus === 'inactive') return { state: 'suspended' };
  if (!sub) return { state: 'none' };

  const end = sub.current_period_end ? new Date(sub.current_period_end) : undefined;
  const grace = (anchor: Date): DerivedState => {
    const graceUntil = new Date(anchor.getTime() + graceDays * DAY);
    return now.getTime() <= graceUntil.getTime() ? { state: 'past_due', graceUntil } : { state: 'expired' };
  };

  switch (sub.status) {
    case SubscriptionStatus.ACTIVE:
      if (!end || now.getTime() <= end.getTime()) return { state: 'active' };
      return sub.cancel_at_period_end ? { state: 'cancelled' } : grace(end);
    case SubscriptionStatus.TRIALING: {
      const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at) : end;
      return !trialEnd || now.getTime() <= trialEnd.getTime() ? { state: 'trial' } : { state: 'expired' };
    }
    case SubscriptionStatus.PAST_DUE:
      return grace(end ?? (sub.updated_at ? new Date(sub.updated_at) : now));
    case SubscriptionStatus.INCOMPLETE:
      return { state: 'payment_pending' };
    case SubscriptionStatus.UNPAID:
      return { state: 'payment_failed' };
    case SubscriptionStatus.CANCELED:
      return { state: 'cancelled' };
    default:
      return { state: 'expired' };
  }
}

/** When a company has several subscription rows, the most useful one decides. */
export const STATE_RANK: EntitlementState[] = [
  'active', 'trial', 'past_due', 'payment_pending', 'payment_failed', 'expired', 'cancelled', 'none', 'suspended',
];
