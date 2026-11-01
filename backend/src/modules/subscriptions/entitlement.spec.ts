import { ENTITLEMENTS, EntitlementState, OWNER_READ_ONLY_STATES, RESTRICTION, allowedFor, deriveState } from './entitlement';
import { SubscriptionStatus as S } from './entities/subscription.entity';

const DAY = 864e5;
const now = new Date('2026-10-31T12:00:00Z');
const at = (d: number) => new Date(now.getTime() + d * DAY);
const sub = (status: S, extra: any = {}) => ({ status, ...extra }) as any;

describe('deriveState', () => {
  const grace = 3;
  it.each([
    [sub(S.ACTIVE, { current_period_end: at(1) }), 'active'],
    [sub(S.ACTIVE, { current_period_end: at(-1) }), 'past_due'],
    [sub(S.ACTIVE, { current_period_end: at(-3.5) }), 'expired'],
    [sub(S.ACTIVE, {}), 'active'], // no end date recorded: provider-managed, trusted
    [sub(S.TRIALING, { trial_ends_at: at(2) }), 'trial'],
    [sub(S.TRIALING, { trial_ends_at: at(-0.1) }), 'expired'],
    [sub(S.PAST_DUE, { current_period_end: at(-2) }), 'past_due'],
    [sub(S.PAST_DUE, { current_period_end: at(-4) }), 'expired'],
    [sub(S.INCOMPLETE), 'payment_pending'],
    [sub(S.UNPAID), 'payment_failed'],
    [sub(S.CANCELED, { current_period_end: at(5) }), 'cancelled'],
    [sub(S.EXPIRED), 'expired'],
  ])('%j -> %s', (s, expected) => {
    expect(deriveState(s, 'active', now, grace).state).toBe(expected);
  });

  it('no subscription -> none', () => {
    expect(deriveState(null, 'active', now, grace).state).toBe('none');
  });

  it('a suspended or inactive company is suspended whatever the subscription says', () => {
    for (const c of ['suspended', 'inactive']) {
      expect(deriveState(sub(S.ACTIVE, { current_period_end: at(10) }), c, now, grace).state).toBe('suspended');
    }
  });

  it('reports the grace deadline only for past_due', () => {
    const r = deriveState(sub(S.ACTIVE, { current_period_end: at(-1) }), 'active', now, grace);
    expect(r.graceUntil?.getTime()).toBe(at(2).getTime());
    expect(deriveState(sub(S.ACTIVE, { current_period_end: at(5) }), 'active', now, grace).graceUntil).toBeUndefined();
  });
});

describe('entitlement matrix', () => {
  const states = Object.keys(ENTITLEMENTS) as EntitlementState[];

  it('defines every state and class', () => {
    expect(states.sort()).toEqual(['active', 'cancelled', 'expired', 'none', 'past_due', 'payment_failed', 'payment_pending', 'suspended', 'trial'].sort());
    for (const s of states) expect(Object.keys(ENTITLEMENTS[s]).sort()).toEqual(['billing', 'read', 'write']);
  });

  it('only trial, active and past_due (grace) may work', () => {
    const working = states.filter((s) => ENTITLEMENTS[s].read && ENTITLEMENTS[s].write).sort();
    expect(working).toEqual(['active', 'past_due', 'trial']);
    for (const s of states) expect(ENTITLEMENTS[s].read).toBe(ENTITLEMENTS[s].write); // no half-open states
  });

  it('billing stays open in every state except suspended', () => {
    for (const s of states) expect(ENTITLEMENTS[s].billing).toBe(s !== 'suspended');
  });

  it('every restricted state has a stable restriction code', () => {
    for (const s of states.filter((x) => !ENTITLEMENTS[x].read)) expect(RESTRICTION[s]?.code).toMatch(/^[A-Z_]+$/);
  });
});

describe('role-aware entitlements (the owner keeps read-only access when a subscription has lapsed)', () => {
  const states = Object.keys(ENTITLEMENTS) as EntitlementState[];

  it('only expired, cancelled and payment_failed give the owner read-only access', () => {
    expect([...OWNER_READ_ONLY_STATES].sort()).toEqual(['cancelled', 'expired', 'payment_failed']);
  });

  it.each(['expired', 'cancelled', 'payment_failed'] as EntitlementState[])('%s: the owner reads, cannot write, still reaches billing', (state) => {
    expect(allowedFor(state, 'owner')).toEqual({ read: true, write: false, billing: true });
  });

  it.each(['sales', 'sales', 'team_lead', 'admin', 'admin', undefined])('%s is blocked from lead operations in every lapsed state', (role) => {
    for (const state of ['expired', 'cancelled', 'payment_failed', 'payment_pending', 'none'] as EntitlementState[]) {
      expect(allowedFor(state, role as any)).toEqual({ read: false, write: false, billing: true });
    }
  });

  it('a suspended company gets nothing, owner included', () => {
    expect(allowedFor('suspended', 'owner')).toEqual({ read: false, write: false, billing: false });
  });

  it('working states are the same for every role', () => {
    for (const state of ['trial', 'active', 'past_due'] as EntitlementState[]) {
      for (const role of ['owner', 'sales', undefined]) expect(allowedFor(state, role as any)).toEqual(ENTITLEMENTS[state]);
    }
  });

  it('never grants the owner more than the base matrix plus read', () => {
    for (const state of states) {
      const owner = allowedFor(state, 'owner');
      expect(owner.write).toBe(ENTITLEMENTS[state].write);
      expect(owner.billing).toBe(ENTITLEMENTS[state].billing);
    }
  });
});
