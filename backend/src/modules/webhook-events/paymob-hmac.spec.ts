import { paymobHmac, verifyPaymobHmac } from './paymob-hmac';

describe('Paymob HMAC', () => {
  const secret = 'test-secret-0123456789abcdef0123456789';
  const obj = {
    amount_cents: 10000, created_at: '2026-10-31T12:00:00.000000', currency: 'EGP', error_occured: false,
    has_parent_transaction: false, id: 123, integration_id: 4001, is_3d_secure: true, is_auth: false, is_capture: false,
    is_refunded: false, is_standalone_payment: true, is_voided: false, order: { id: 55 }, owner: 1, pending: false,
    source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' }, success: true,
  };

  it('verifies the signature of the exact payload', () => {
    expect(verifyPaymobHmac(obj, paymobHmac(obj, secret), secret)).toBe(true);
  });

  it('rejects a changed field, a wrong secret, and malformed or missing signatures', () => {
    const good = paymobHmac(obj, secret);
    expect(verifyPaymobHmac({ ...obj, amount_cents: 1 }, good, secret)).toBe(false);
    expect(verifyPaymobHmac({ ...obj, success: false }, good, secret)).toBe(false);
    expect(verifyPaymobHmac(obj, paymobHmac(obj, 'other'), secret)).toBe(false);
    expect(verifyPaymobHmac(obj, 'abc', secret)).toBe(false);
    expect(verifyPaymobHmac(obj, undefined, secret)).toBe(false);
    expect(verifyPaymobHmac(undefined, good, secret)).toBe(false);
  });
});
