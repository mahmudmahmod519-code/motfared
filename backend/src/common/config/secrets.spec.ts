import { configuredSecret } from './secrets';

describe('configuredSecret', () => {
  it('accepts a real-looking secret', () => {
    expect(configuredSecret('whsec_0123456789abcdef0123456789abcdef')).toBe('whsec_0123456789abcdef0123456789abcdef');
  });

  it.each([undefined, null, '', '   ', 'whsec_...', '...', 'short', 'change-me-in-production', 'your-paymob-hmac-secret', 'sk_test_...'])(
    'treats %p as not configured (callers must fail closed)',
    (v) => {
      expect(configuredSecret(v as any)).toBeUndefined();
    },
  );
});
