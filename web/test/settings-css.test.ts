import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { read, WEB_ROOT } from './legacy';

/**
 * New SaaS pages have no original to copy, so they must at least speak the original's design language: every
 * colour, radius and shadow comes from the tokens (one theme, light and dark alike), never a literal.
 */
describe('settings page stylesheet uses the design tokens only', () => {
  const css = read(path.join(WEB_ROOT, 'components', 'pages', 'settings.css')).replace(/\/\*[\s\S]*?\*\//g, '');

  it('has no literal colour', () => {
    expect(css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) ?? []).toEqual([]);
  });

  it('takes colours, radii and shadows from var(--…)', () => {
    for (const prop of ['color', 'background', 'border-radius', 'box-shadow', 'accent-color']) {
      for (const m of css.matchAll(new RegExp(`(?:^|[;{\\s])${prop}:\\s*([^;}]+)`, 'g'))) {
        expect(m[1], `${prop}: ${m[1]}`).toMatch(/var\(--|^0$|^none$|^transparent$|^inherit$/);
      }
    }
    for (const m of css.matchAll(/border(?:-top)?:\s*([^;}]+)/g)) expect(m[1], m[0]).toMatch(/var\(--|^0$/);
  });

  it('only uses tokens that exist', () => {
    const tokens = read(path.join(WEB_ROOT, 'styles', 'tokens.css'));
    for (const [, name] of css.matchAll(/var\((--[\w-]+)\)/g)) expect(tokens, name).toContain(`${name}:`);
  });
});
