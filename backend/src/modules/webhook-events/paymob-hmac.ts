import { createHmac, timingSafeEqual } from 'crypto';

/** Transaction-callback fields, concatenated in this order, per Paymob's HMAC calculation docs. */
export const PAYMOB_HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id', 'integration_id',
  'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment', 'is_voided', 'order.id', 'owner',
  'pending', 'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
];

const pick = (o: any, path: string) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);

export function paymobHmac(obj: any, secret: string): string {
  const data = PAYMOB_HMAC_FIELDS.map((f) => {
    const v = pick(obj, f);
    return v === undefined || v === null ? '' : String(v);
  }).join('');
  return createHmac('sha512', secret).update(data).digest('hex');
}

export function verifyPaymobHmac(obj: any, received: string | undefined, secret: string): boolean {
  if (!obj || typeof received !== 'string' || !/^[0-9a-f]{128}$/i.test(received)) return false;
  const expected = Buffer.from(paymobHmac(obj, secret), 'hex');
  const actual = Buffer.from(received, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
