/**
 * Fail-closed coverage: every controller in the app must be protected by the subscription
 * guard (via @TenantApi) or appear on the explicit exemption list below with a reason.
 * A new controller therefore cannot ship unguarded by accident.
 */
import { bootstrap } from './harness';
import { ModulesContainer } from '@nestjs/core';
import { SubscriptionGuard } from '../../src/common/guards/subscription.guard';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';

const EXEMPT: Record<string, string> = {
  AuthController: 'login/register/me/logout must work in every state; /auth/me reports the entitlement',
  WebhookEventsController: 'public provider callbacks authenticated by signature; GET /events is platform_admin only',
  MobileAuthController: 'mobile sign-in/sign-out/password change must work in every state; the app needs them to show and resolve a restriction',
  PlansController: 'public price catalogue (writes are platform_admin only)',
  PlanPricesController: 'public price catalogue (writes are platform_admin only)',
  IndustriesController: 'public list of industry templates (words and features); holds no company data',
};

describe('Subscription guard coverage', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  beforeAll(async () => { h = await bootstrap({ reset: true, noThrottle: true }); });
  afterAll(async () => { await h.app?.close(); });

  it('every controller is guarded or explicitly exempt', () => {
    const controllers: any[] = [];
    for (const mod of h.app.get(ModulesContainer).values()) {
      for (const w of mod.controllers.values()) controllers.push(w.metatype);
    }
    expect(controllers.length).toBeGreaterThan(15);
    const unguarded = controllers
      .filter((c) => !(Reflect.getMetadata('__guards__', c) || []).includes(SubscriptionGuard))
      .map((c) => c.name)
      .filter((n) => !(n in EXEMPT));
    expect(unguarded).toEqual([]);
  });

  it('the exemption list has no stale entries and exempt controllers do not hold tenant data', () => {
    const names = new Set<string>();
    for (const mod of h.app.get(ModulesContainer).values()) for (const w of mod.controllers.values()) names.add(w.metatype.name);
    for (const n of Object.keys(EXEMPT)) expect(names.has(n)).toBe(true);
  });

  it('every guarded controller also requires authentication', () => {
    for (const mod of h.app.get(ModulesContainer).values()) {
      for (const w of mod.controllers.values()) {
        const guards = Reflect.getMetadata('__guards__', w.metatype) || [];
        if (guards.includes(SubscriptionGuard)) expect(guards).toContain(JwtAuthGuard);
      }
    }
  });
});
