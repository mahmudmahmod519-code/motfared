import { resolveJwtSecret } from './jwt-secret';

describe('resolveJwtSecret', () => {
  const strong = 'a-random-secret-that-is-at-least-32-chars-long';

  it('accepts a strong configured secret', () => {
    expect(resolveJwtSecret(strong, 'production')).toBe(strong);
  });

  it.each([undefined, '', 'short', 'change-me-in-production'])('refuses %p in production', (value) => {
    expect(() => resolveJwtSecret(value as any, 'production')).toThrow(/JWT_SECRET/);
  });

  it('never returns a placeholder outside production: uses a stable random secret', () => {
    const a = resolveJwtSecret('change-me-in-production', 'development');
    const b = resolveJwtSecret(undefined, 'test');
    expect(a).not.toBe('change-me-in-production');
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(b).toBe(a);
  });
});
