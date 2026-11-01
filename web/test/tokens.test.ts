import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { customProps, legacyCss, LEGACY_DESIGN_MD, parseCss, read, requireLegacy, WEB_ROOT } from './legacy';

const legacy = () => (requireLegacy(), parseCss(legacyCss()));
const ours = () => parseCss(read(path.join(WEB_ROOT, 'styles/tokens.css')));

const LIGHT = '|:root';
const DARK_MEDIA = '@media(prefers-color-scheme:dark)|:root';
const OUR_DARK_AUTO = '@media(prefers-color-scheme:dark)|:root:not([data-theme="light"])';
const OUR_DARK_FORCED = '|:root[data-theme="dark"]';

describe('design tokens are the original dashboard\'s, verbatim', () => {
  it('light theme: every custom property and its value equals the original (nothing added, nothing missing)', () => {
    const expected = customProps(legacy(), LIGHT);
    expect(Object.keys(expected).length).toBeGreaterThan(30);
    expect(customProps(ours(), LIGHT)).toEqual(expected);
  });

  it('dark theme (follows the system): equals the original dark set', () => {
    expect(customProps(ours(), OUR_DARK_AUTO)).toEqual(customProps(legacy(), DARK_MEDIA));
  });

  it('dark theme (chosen by the user): identical to the system-dark set, so the two can never drift', () => {
    expect(customProps(ours(), OUR_DARK_FORCED)).toEqual(customProps(ours(), OUR_DARK_AUTO));
  });

  it('colour-scheme is declared for both themes', () => {
    const o = ours();
    expect(o.get(LIGHT)!.has('color-scheme:light')).toBe(true);
    expect(o.get(OUR_DARK_AUTO)!.has('color-scheme:dark')).toBe(true);
    expect(o.get(OUR_DARK_FORCED)!.has('color-scheme:dark')).toBe(true);
    expect(o.get('|:root[data-theme="light"]')?.has('color-scheme:light')).toBe(true);
  });

  it('a chosen light theme beats a dark system setting (the dark block is skipped for it)', () => {
    expect(OUR_DARK_AUTO).toContain(':not([data-theme="light"])');
  });

  it('the documented numbers hold: brand blue, radii, sidebar width', () => {
    const l = customProps(ours(), LIGHT);
    expect(l['--brand']).toBe('#1e5fbf');
    expect(l['--radius-sm']).toBe('8px');
    expect(l['--radius']).toBe('12px');
    expect(l['--radius-lg']).toBe('16px');
    expect(l['--sidebar-w']).toBe('252px');
    expect(customProps(ours(), OUR_DARK_AUTO)['--page']).toBe('#0e131a'); // blue-tinted ink, not black
  });

  it('DESIGN.md (the original\'s written reference) agrees with the tokens it documents', () => {
    requireLegacy();
    const md = read(LEGACY_DESIGN_MD);
    const sections = md.split(/^## /m);
    const light = sections.find((s) => s.startsWith('الألوان — الوضع الفاتح'))!;
    const dark = sections.find((s) => s.startsWith('الألوان — الوضع الغامق'))!;
    const read1 = (block: string) =>
      Object.fromEntries(
        [...block.matchAll(/^([a-z0-9-]+)(?: \([^)]*\))?:\s+(#[0-9a-f]{6}|rgba\([^)]*\))/gim)].map((m) => [`--${m[1].toLowerCase()}`, m[2].toLowerCase().replace(/\s+/g, '')]),
      );
    // DESIGN.md names the page background and the text colours the same way as the CSS variables
    const docLight = read1(light);
    const docDark = read1(dark);
    const cssLight = customProps(ours(), LIGHT);
    const cssDark = customProps(ours(), OUR_DARK_AUTO);
    const strip = (v: string) => v.replace(/\s+/g, '').toLowerCase();
    expect(Object.keys(docLight).length).toBeGreaterThan(20);
    for (const [k, v] of Object.entries(docLight)) expect([k, strip(cssLight[k])]).toEqual([k, v]);
    for (const [k, v] of Object.entries(docDark)) expect([k, strip(cssDark[k])]).toEqual([k, v]);
  });
});
