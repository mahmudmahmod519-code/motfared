/**
 * Phase 3 — billing: webhook verification/idempotency/ordering and the manual InstaPay flow.
 * Written before the implementation; run with `npm run test:tenant` (scratch MySQL, see tenant-isolation spec).
 */
import { PAYMOB_SECRET, STRIPE_SECRET, bootstrap, DENIED } from './harness';
import Stripe from 'stripe';
import { createHmac } from 'crypto';
import { Plan } from '../../src/modules/plans/entities/plan.entity';
import { PlanPrice, PriceInterval } from '../../src/modules/plan-prices/entities/plan-price.entity';
import { Subscription, SubscriptionStatus } from '../../src/modules/subscriptions/entities/subscription.entity';
import { SubscriptionProviderRef } from '../../src/modules/subscription-provider-refs/entities/subscription-provider-ref.entity';
import { Payment, PaymentStatus } from '../../src/modules/payments/entities/payment.entity';
import { WebhookEvent } from '../../src/modules/webhook-events/entities/webhook-event.entity';

const stripeLib = new Stripe('sk_test_unused');
const DAY = 864e5;

describe('Billing (Stripe / Paymob / manual InstaPay)', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const ids: Record<string, string> = {};
  let seq = 0;
  const n = () => `${Date.now()}${++seq}`;

  beforeAll(async () => {
    h = await bootstrap();
    const A = await h.mkCompany('Billing A');
    const B = await h.mkCompany('Billing B');
    ids.A = A.id; ids.B = B.id;
    ids.ceoA = (await h.mkUser('CEO A', 'bill-owner-a@t.test', A.id, 'owner')).id;
    ids.ceoB = (await h.mkUser('CEO B', 'bill-owner-b@t.test', B.id, 'owner')).id;
    ids.agentA = (await h.mkUser('Agent A', 'bill-agent-a@t.test', A.id, 'sales')).id;
    ids.admin = (await h.mkUser('Admin', 'bill-admin@t.test', null, undefined, 'platform_admin')).id;
    const plan = await h.db.getRepository(Plan).save({ name: 'Pro', slug: `pro-${n()}`, is_active: true } as any);
    const month = await h.db.getRepository(PlanPrice).save({ plan_id: plan.id, amount: 100, currency: 'EGP', interval: PriceInterval.MONTH, is_active: true } as any);
    ids.price = month.id;
    await h.login('ceoA', 'bill-owner-a@t.test');
    await h.login('ceoB', 'bill-owner-b@t.test');
    await h.login('agentA', 'bill-agent-a@t.test');
    await h.login('admin', 'bill-admin@t.test');
  });
  afterAll(async () => { await h.app?.close(); });

  const newSub = async (status = SubscriptionStatus.INCOMPLETE, extra: any = {}) =>
    h.db.getRepository(Subscription).save({
      company_id: ids.A, plan_price_id: ids.price, status, starts_at: new Date(), ...extra,
    } as any) as Promise<Subscription>;
  const subOf = (id: string) => h.db.getRepository(Subscription).findOneByOrFail({ id });
  const payments = (subscription_id: string) => h.db.getRepository(Payment).findBy({ subscription_id });

  // ───────────────────────────── Stripe ─────────────────────────────
  describe('Stripe webhook', () => {
    const now = () => Math.floor(Date.now() / 1000);
    const invoiceEvent = (stripeSub: string, o: Partial<{ eventId: string; type: string; created: number; invoiceId: string; amount: number; currency: string; start: number; end: number }> = {}) => {
      const start = o.start ?? now();
      const end = o.end ?? start + 30 * 86400;
      return {
        id: o.eventId ?? `evt_${n()}`,
        object: 'event',
        type: o.type ?? 'invoice.payment_succeeded',
        created: o.created ?? now(),
        data: { object: {
          id: o.invoiceId ?? `in_${n()}`, object: 'invoice', subscription: stripeSub, payment_intent: `pi_${n()}`,
          amount_paid: o.amount ?? 10000, currency: o.currency ?? 'egp', period_start: start, period_end: end,
          lines: { data: [{ period: { start, end } }] },
        } },
      };
    };
    const send = (event: any, opts: { secret?: string; header?: string | null; timestamp?: number } = {}) => {
      const payload = JSON.stringify(event);
      const header = opts.header === undefined
        ? stripeLib.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? STRIPE_SECRET, timestamp: opts.timestamp })
        : opts.header;
      let req = h.http().post('/api/webhooks/stripe').set('Content-Type', 'application/json');
      if (header) req = req.set('Stripe-Signature', header);
      return req.send(payload);
    };
    const linked = async (status = SubscriptionStatus.INCOMPLETE, extra: any = {}) => {
      const sub = await newSub(status, extra);
      const ref = `sub_${n()}`;
      await h.db.getRepository(SubscriptionProviderRef).save({ subscription_id: sub.id, provider: 'stripe', provider_subscription_id: ref } as any);
      return { sub, ref };
    };

    it('a correctly signed payment event activates the subscription and records the payment', async () => {
      const { sub, ref } = await linked();
      const start = now(); const end = start + 30 * 86400;
      const res = await send(invoiceEvent(ref, { start, end }));
      expect(res.status).toBe(200);
      const after = await subOf(sub.id);
      expect(after.status).toBe(SubscriptionStatus.ACTIVE);
      expect(Math.floor(after.current_period_end.getTime() / 1000)).toBe(end);
      const pays = await payments(sub.id);
      expect(pays).toHaveLength(1);
      expect(pays[0]).toMatchObject({ provider: 'stripe', status: PaymentStatus.SUCCEEDED, currency: 'EGP' });
      expect(Number(pays[0].amount)).toBe(100);
    });

    it.each([
      ['wrong secret', { secret: 'whsec_wrong_secret_value_0123456789abcdef' }],
      ['missing header', { header: null }],
      ['garbage header', { header: 't=1,v1=deadbeef' }],
      ['timestamp outside tolerance', { timestamp: Math.floor(Date.now() / 1000) - 3600 }],
    ])('rejects %s and changes nothing', async (_n, opts: any) => {
      const { sub, ref } = await linked();
      const res = await send(invoiceEvent(ref), opts);
      expect(res.status).toBe(401);
      expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.INCOMPLETE);
      expect(await payments(sub.id)).toHaveLength(0);
    });

    it('rejects a body that was altered after signing', async () => {
      const { sub, ref } = await linked();
      const signedFor = JSON.stringify(invoiceEvent(ref, { amount: 10000 }));
      const header = stripeLib.webhooks.generateTestHeaderString({ payload: signedFor, secret: STRIPE_SECRET });
      const res = await h.http().post('/api/webhooks/stripe').set('Content-Type', 'application/json').set('Stripe-Signature', header)
        .send(signedFor.replace('10000', '99999999'));
      expect(res.status).toBe(401);
      expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.INCOMPLETE);
    });

    it('a re-delivered event is acknowledged but processed once', async () => {
      const { sub, ref } = await linked();
      const ev = invoiceEvent(ref);
      expect((await send(ev)).status).toBe(200);
      const again = await send(ev);
      expect(again.status).toBe(200);
      expect(again.body.duplicate).toBe(true);
      expect(await payments(sub.id)).toHaveLength(1);
      expect(await h.db.getRepository(WebhookEvent).countBy({ provider: 'stripe', provider_event_id: ev.id })).toBe(1);
    });

    it('the same invoice reported by two different events creates one payment', async () => {
      const { sub, ref } = await linked();
      const invoiceId = `in_${n()}`;
      await send(invoiceEvent(ref, { invoiceId, type: 'invoice.payment_succeeded' }));
      await send(invoiceEvent(ref, { invoiceId, type: 'invoice.paid' }));
      expect(await payments(sub.id)).toHaveLength(1);
    });

    it('concurrent deliveries of one event still process once', async () => {
      const { sub, ref } = await linked();
      const ev = invoiceEvent(ref);
      const results = await Promise.all([send(ev), send(ev), send(ev)]);
      results.forEach((r) => expect([200, 409]).toContain(r.status));
      expect(await payments(sub.id)).toHaveLength(1);
      expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('does not activate when the paid amount or currency differs from the plan price', async () => {
      for (const o of [{ amount: 100 }, { currency: 'usd' }]) {
        const { sub, ref } = await linked();
        const event = invoiceEvent(ref, o);
        const res = await send(event);
        expect(res.status).toBe(200); // acknowledged: retrying cannot fix a mismatch
        expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.INCOMPLETE);
        expect(await payments(sub.id)).toHaveLength(0);
        const ev = await h.db.getRepository(WebhookEvent).findOneBy({ provider: 'stripe', provider_event_id: event.id });
        expect(ev?.processing_error).toMatch(/mismatch/i);
      }
    });

    it('an event for an unknown provider subscription is acknowledged and ignored', async () => {
      const res = await send(invoiceEvent(`sub_unknown_${n()}`));
      expect(res.status).toBe(200);
    });

    it('out of order: an older payment event cannot resurrect a subscription cancelled later', async () => {
      const { sub, ref } = await linked(SubscriptionStatus.ACTIVE, { current_period_end: new Date(Date.now() + DAY) });
      const t = now();
      const del = { id: `evt_${n()}`, object: 'event', type: 'customer.subscription.deleted', created: t, data: { object: { id: ref, object: 'subscription', status: 'canceled' } } };
      expect((await send(del)).status).toBe(200);
      expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.CANCELED);
      const older = invoiceEvent(ref, { created: t - 600 });
      expect((await send(older)).status).toBe(200);
      expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.CANCELED);
      expect(await payments(sub.id)).toHaveLength(1); // the money is still recorded
    });

    it('a failed payment marks past_due; a later successful one restores active', async () => {
      const { sub, ref } = await linked(SubscriptionStatus.ACTIVE, { current_period_end: new Date(Date.now() + DAY) });
      const t = now();
      expect((await send(invoiceEvent(ref, { type: 'invoice.payment_failed', created: t }))).status).toBe(200);
      expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.PAST_DUE);
      expect((await send(invoiceEvent(ref, { created: t + 60 }))).status).toBe(200);
      expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('a verified, amount-checked payment reactivates an expired subscription', async () => {
      const { sub, ref } = await linked(SubscriptionStatus.EXPIRED, { current_period_end: new Date(Date.now() - 30 * DAY) });
      expect((await send(invoiceEvent(ref))).status).toBe(200);
      const after = await subOf(sub.id);
      expect(after.status).toBe(SubscriptionStatus.ACTIVE);
      expect(after.current_period_end.getTime()).toBeGreaterThan(Date.now());
    });

    it('a period never moves backwards', async () => {
      const far = new Date(Math.floor((Date.now() + 90 * DAY) / 1000) * 1000); // MySQL timestamps are whole seconds
      const { sub, ref } = await linked(SubscriptionStatus.ACTIVE, { current_period_end: far });
      await send(invoiceEvent(ref, { start: now(), end: now() + 30 * 86400 }));
      expect((await subOf(sub.id)).current_period_end.getTime()).toBe(far.getTime());
    });
  });

  // ───────────────────────────── Paymob ─────────────────────────────
  describe('Paymob callback', () => {
    const FIELDS = ['amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id', 'integration_id',
      'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment', 'is_voided', 'order.id', 'owner',
      'pending', 'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success'];
    const pick = (o: any, path: string) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
    const sign = (obj: any, secret = PAYMOB_SECRET) =>
      createHmac('sha512', secret).update(FIELDS.map((f) => String(pick(obj, f))).join('')).digest('hex');
    const txn = (orderId: string, o: any = {}) => ({
      id: Number(n().slice(-9)), amount_cents: 10000, created_at: '2026-10-31T12:00:00.000000', currency: 'EGP',
      error_occured: false, has_parent_transaction: false, integration_id: 4001, is_3d_secure: true, is_auth: false,
      is_capture: false, is_refunded: false, is_standalone_payment: true, is_voided: false, order: { id: Number(orderId) },
      owner: 1, pending: false, source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' }, success: true, ...o,
    });
    const send = (obj: any, hmac?: string) =>
      h.http().post(`/api/webhooks/paymob?hmac=${hmac ?? sign(obj)}`).send({ type: 'TRANSACTION', obj });
    const pending = async (status = SubscriptionStatus.INCOMPLETE, extra: any = {}) => {
      const sub = await newSub(status, extra);
      const orderId = n().slice(-10);
      const pay = await h.db.getRepository(Payment).save({
        subscription_id: sub.id, provider: 'paymob', provider_payment_id: orderId, amount: 100, currency: 'EGP',
        status: PaymentStatus.PENDING, idempotency_key: `paymob-order-${orderId}`,
      } as any);
      return { sub, pay, orderId };
    };

    it('a valid successful callback marks the payment paid and activates for one period', async () => {
      const { sub, pay, orderId } = await pending();
      const res = await send(txn(orderId));
      expect(res.status).toBe(200);
      expect((await h.db.getRepository(Payment).findOneByOrFail({ id: pay.id })).status).toBe(PaymentStatus.SUCCEEDED);
      const after = await subOf(sub.id);
      expect(after.status).toBe(SubscriptionStatus.ACTIVE);
      const days = (after.current_period_end.getTime() - Date.now()) / DAY;
      expect(days).toBeGreaterThan(27);
      expect(days).toBeLessThan(32);
    });

    it.each([
      ['wrong hmac', (obj: any) => sign(obj, 'another_secret_0123456789abcdef0123456789')],
      ['missing hmac', () => ''],
    ])('rejects %s', async (_n, hm) => {
      const { sub, orderId } = await pending();
      const obj = txn(orderId);
      const res = await h.http().post(`/api/webhooks/paymob${(hm as any)(obj) ? `?hmac=${(hm as any)(obj)}` : ''}`).send({ type: 'TRANSACTION', obj });
      expect(res.status).toBe(401);
      expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.INCOMPLETE);
    });

    it('rejects a body tampered after signing (amount changed)', async () => {
      const { sub, orderId } = await pending();
      const obj = txn(orderId, { amount_cents: 100 });
      const res = await send({ ...obj, amount_cents: 10000 }, sign(obj));
      expect(res.status).toBe(401);
      expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.INCOMPLETE);
    });

    it('does not activate when the amount or currency does not match the pending payment', async () => {
      for (const o of [{ amount_cents: 5000 }, { currency: 'USD' }]) {
        const { sub, pay, orderId } = await pending();
        const res = await send(txn(orderId, o));
        expect(res.status).toBe(200);
        expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.INCOMPLETE);
        expect((await h.db.getRepository(Payment).findOneByOrFail({ id: pay.id })).status).toBe(PaymentStatus.PENDING);
      }
    });

    it('a duplicate callback does not extend the period twice', async () => {
      const { sub, orderId } = await pending();
      const obj = txn(orderId);
      await send(obj);
      const first = (await subOf(sub.id)).current_period_end.getTime();
      const again = await send(obj);
      expect(again.status).toBe(200);
      expect((await subOf(sub.id)).current_period_end.getTime()).toBe(first);
    });

    it('a failed transaction marks the payment failed and never activates', async () => {
      const { sub, pay, orderId } = await pending();
      expect((await send(txn(orderId, { success: false, error_occured: true }))).status).toBe(200);
      expect((await h.db.getRepository(Payment).findOneByOrFail({ id: pay.id })).status).toBe(PaymentStatus.FAILED);
      expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.INCOMPLETE);
    });

    it('a success callback after a refund/void does not re-activate', async () => {
      const { sub, pay, orderId } = await pending();
      await h.db.getRepository(Payment).update(pay.id, { status: PaymentStatus.REFUNDED });
      await send(txn(orderId));
      expect((await subOf(sub.id)).status).toBe(SubscriptionStatus.INCOMPLETE);
    });
  });

  // ───────────────────────── Manual InstaPay ─────────────────────────
  describe('Manual InstaPay / WhatsApp workflow', () => {
    const submit = (who: string, o: any = {}) =>
      h.post(who, '/billing/manual-requests', { plan_price_id: ids.price, reference: `IP-${n()}`, payer_phone: '+201000000000', note: 'sent via InstaPay', ...o });

    it('CEO logs a request in pending_verification; the amount comes from the price, not the client', async () => {
      const res = await submit('ceoA');
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ company_id: ids.A, status: 'pending_verification', currency: 'EGP' });
      expect(Number(res.body.expected_amount)).toBe(100);
      expect(res.body.created_at).toBeDefined();
      expect((await submit('ceoA', { expected_amount: 1 })).status).toBe(400);
      expect((await submit('ceoA', { company_id: ids.B })).status).toBe(400);
    });

    it('submitting (or attaching a receipt reference) never activates anything', async () => {
      const before = await h.db.getRepository(Subscription).countBy({ company_id: ids.A, status: SubscriptionStatus.ACTIVE });
      await submit('ceoA', { receipt_reference: 'https://example.test/receipt.png' });
      expect(await h.db.getRepository(Subscription).countBy({ company_id: ids.A, status: SubscriptionStatus.ACTIVE })).toBe(before);
    });

    it('only CEOs of the company can submit; agents and outsiders cannot', async () => {
      expect(DENIED).toContain((await submit('agentA')).status);
      expect((await submit('ceoB')).status).toBe(201); // other company can, for its own company
    });

    it('rejects a reference that was already used (even by another company)', async () => {
      const reference = `IP-dup-${n()}`;
      expect((await submit('ceoA', { reference })).status).toBe(201);
      expect((await submit('ceoB', { reference })).status).toBe(409);
      expect((await submit('ceoA', { reference: reference.toLowerCase() })).status).toBe(409);
    });

    it('a CEO sees only their own company requests; the admin sees all', async () => {
      const a = (await submit('ceoA')).body;
      const b = (await submit('ceoB')).body;
      const listA = JSON.stringify((await h.get('ceoA', '/billing/manual-requests')).body);
      expect(listA).toContain(a.id);
      expect(listA).not.toContain(b.id);
      expect(DENIED).toContain((await h.get('ceoA', `/billing/manual-requests/${b.id}`)).status);
      const all = JSON.stringify((await h.get('admin', '/billing/manual-requests')).body);
      expect(all).toContain(a.id);
      expect(all).toContain(b.id);
    });

    it('a CEO cannot approve or reject, not even their own request', async () => {
      const r = (await submit('ceoA')).body;
      expect(DENIED).toContain((await h.post('ceoA', `/billing/manual-requests/${r.id}/approve`, {})).status);
      expect(DENIED).toContain((await h.post('ceoA', `/billing/manual-requests/${r.id}/reject`, { note: 'x' })).status);
      expect((await h.get('ceoA', `/billing/manual-requests/${r.id}`)).body.status).toBe('pending_verification');
    });

    it('admin approval records the audit trail, creates the payment and activates for one period', async () => {
      await h.db.getRepository(Subscription).delete({ company_id: ids.B });
      const r = (await submit('ceoB')).body;
      const res = await h.post('admin', `/billing/manual-requests/${r.id}/approve`, { note: 'matched InstaPay statement' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'approved', reviewed_by: ids.admin, review_note: 'matched InstaPay statement' });
      expect(res.body.reviewed_at).toBeDefined();
      const sub = await h.db.getRepository(Subscription).findOneByOrFail({ company_id: ids.B, status: SubscriptionStatus.ACTIVE });
      const days = (sub.current_period_end.getTime() - Date.now()) / DAY;
      expect(days).toBeGreaterThan(27);
      expect(days).toBeLessThan(32);
      const pays = await payments(sub.id);
      expect(pays).toHaveLength(1);
      expect(pays[0]).toMatchObject({ provider: 'instapay', status: PaymentStatus.SUCCEEDED });
      expect(Number(pays[0].amount)).toBe(100);
    });

    it('approving twice, or deciding an already decided request, is a conflict and activates nothing more', async () => {
      const r = (await submit('ceoA')).body;
      expect((await h.post('admin', `/billing/manual-requests/${r.id}/approve`, {})).status).toBe(201);
      const subs = await h.db.getRepository(Subscription).findBy({ company_id: ids.A, status: SubscriptionStatus.ACTIVE });
      const payCount = (await Promise.all(subs.map((s) => payments(s.id)))).flat().filter((p) => p.provider === 'instapay').length;
      expect((await h.post('admin', `/billing/manual-requests/${r.id}/approve`, {})).status).toBe(409);
      expect((await h.post('admin', `/billing/manual-requests/${r.id}/reject`, { note: 'late' })).status).toBe(409);
      const after = (await Promise.all((await h.db.getRepository(Subscription).findBy({ company_id: ids.A })).map((s) => payments(s.id)))).flat().filter((p) => p.provider === 'instapay');
      expect(after).toHaveLength(payCount);
    });

    it('concurrent approvals activate once', async () => {
      const r = (await submit('ceoA')).body;
      const before = (await Promise.all((await h.db.getRepository(Subscription).findBy({ company_id: ids.A })).map((s) => payments(s.id)))).flat().filter((p) => p.provider === 'instapay').length;
      const rs = await Promise.all([1, 2, 3].map(() => h.post('admin', `/billing/manual-requests/${r.id}/approve`, {})));
      expect(rs.filter((x) => x.status === 201)).toHaveLength(1);
      const after = (await Promise.all((await h.db.getRepository(Subscription).findBy({ company_id: ids.A })).map((s) => payments(s.id)))).flat().filter((p) => p.provider === 'instapay').length;
      expect(after).toBe(before + 1);
    });

    it('rejection needs a note, is audited and activates nothing', async () => {
      const r = (await submit('ceoA')).body;
      expect((await h.post('admin', `/billing/manual-requests/${r.id}/reject`, {})).status).toBe(400);
      const res = await h.post('admin', `/billing/manual-requests/${r.id}/reject`, { note: 'no matching transfer' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'rejected', reviewed_by: ids.admin, review_note: 'no matching transfer' });
      expect((await h.post('admin', `/billing/manual-requests/${r.id}/approve`, {})).status).toBe(409);
    });
  });
});
