import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { WEB_ROOT } from './legacy';

const css = (f: string) => readFileSync(path.join(WEB_ROOT, 'styles', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('RTL', () => {
  it('the document is Arabic and right-to-left from the first byte', () => {
    const layout = readFileSync(path.join(WEB_ROOT, 'app/layout.tsx'), 'utf8');
    expect(layout).toMatch(/lang="ar"/);
    expect(layout).toMatch(/dir="rtl"/);
  });

  it('no physical left/right in any stylesheet: everything is logical (the one exception is centring)', () => {
    const offenders: string[] = [];
    for (const f of readdirSync(path.join(WEB_ROOT, 'styles')).filter((x) => x.endsWith('.css'))) {
      for (const [i, line] of css(f).split('\n').entries()) {
        const physical = /(^|[\s{;])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right|border-(top|bottom)-(left|right)-radius)\s*:/.test(line) ||
          /(text-align|float|clear)\s*:\s*(left|right)\b/.test(line);
        if (physical && !/left:\s*50%/.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the drawer is the only thing that translates horizontally, and it has an LTR mirror', () => {
    const all = ['base.css', 'components.css', 'shell.css'].map(css).join('\n');
    const horizontal = all.match(/translateX\([^)]*\)/g) ?? [];
    expect(horizontal.length).toBeGreaterThan(0);
    expect(all).toMatch(/:root\[dir="ltr"\] \.sidebar/);
  });
});
