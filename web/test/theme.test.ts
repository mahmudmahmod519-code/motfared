import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, effectiveTheme, nextPreference, parsePreference, themeInitScript } from '../lib/theme';

describe('theme preference', () => {
  it('parses what was stored, and falls back to following the system', () => {
    expect(parsePreference('light')).toBe('light');
    expect(parsePreference('dark')).toBe('dark');
    expect(parsePreference('system')).toBe('system');
    for (const bad of [null, undefined, '', 'Dark', 'blue', '{"x":1}', 3]) expect(parsePreference(bad as any)).toBe('system');
  });

  it('system follows the OS; an explicit choice wins over it', () => {
    expect(effectiveTheme('system', true)).toBe('dark');
    expect(effectiveTheme('system', false)).toBe('light');
    expect(effectiveTheme('light', true)).toBe('light');
    expect(effectiveTheme('dark', false)).toBe('dark');
  });

  it('cycles system → light → dark → system', () => {
    expect(nextPreference('system')).toBe('light');
    expect(nextPreference('light')).toBe('dark');
    expect(nextPreference('dark')).toBe('system');
  });
});

describe('the pre-paint script (no flash of the wrong theme)', () => {
  const run = (stored: string | null | 'throws') => {
    const attrs = new Map<string, string>();
    const doc = { documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v), removeAttribute: (k: string) => attrs.delete(k) } };
    const storage = {
      getItem: (k: string) => {
        if (stored === 'throws') throw new Error('blocked');
        return k === THEME_STORAGE_KEY ? stored : null;
      },
    };
    new Function('document', 'localStorage', themeInitScript)(doc, storage);
    return attrs;
  };

  it('applies a stored light or dark choice before first paint', () => {
    expect(run('dark').get('data-theme')).toBe('dark');
    expect(run('light').get('data-theme')).toBe('light');
  });

  it('leaves the attribute off when following the system, or when nothing valid is stored', () => {
    for (const s of ['system', null, 'junk']) expect(run(s as any).has('data-theme')).toBe(false);
  });

  it('survives storage being blocked (private windows)', () => {
    expect(() => run('throws')).not.toThrow();
    expect(run('throws').has('data-theme')).toBe(false);
  });
});
