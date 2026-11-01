import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { LEGACY_PUBLIC, parseCss, read, requireLegacy, sha256, WEB_ROOT } from './legacy';

describe('fonts', () => {
  it('IBM Plex Sans Arabic is self-hosted, byte-identical to the original files', () => {
    requireLegacy();
    for (const f of ['IBMPlexSansArabic-Regular.woff2', 'IBMPlexSansArabic-SemiBold.woff2']) {
      expect(sha256(path.join(WEB_ROOT, 'public/fonts', f))).toBe(sha256(path.join(LEGACY_PUBLIC, 'fonts', f)));
    }
  });

  it('the two faces are declared for 400 and 600-700 with font-display: swap, from our own origin', () => {
    const css = parseCss(read(path.join(WEB_ROOT, 'styles/base.css')));
    const faces = [...css.entries()].filter(([k]) => k.includes('@font-face')).flatMap(([, v]) => [...v]);
    expect(faces).toHaveLength(2);
    expect(faces.some((f) => f.includes('IBMPlexSansArabic-Regular.woff2') && f.includes('font-weight:400'))).toBe(true);
    expect(faces.some((f) => f.includes('IBMPlexSansArabic-SemiBold.woff2') && f.includes('font-weight:600 700'))).toBe(true);
    for (const f of faces) {
      expect(f).toContain('font-display:swap');
      expect(f).not.toMatch(/https?:\/\//); // never from a CDN
      expect(f).toContain('url("/fonts/');
    }
  });

  it('the base text settings match the design reference', () => {
    const css = parseCss(read(path.join(WEB_ROOT, 'styles/base.css')));
    const body = css.get('|body')!;
    expect(body.has('font-size:15px')).toBe(true);
    expect(body.has('line-height:1.55')).toBe(true);
    expect([...body].find((d) => d.startsWith('font-family:'))).toBe('font-family:"IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",sans-serif');
    expect(css.get('|h1,h2,h3,h4')!.has('letter-spacing:-0.011em')).toBe(true);
    expect(css.get('|h1,h2,h3,h4')!.has('text-wrap:balance')).toBe(true);
  });

  it('table headers are not tracked or upper-cased (Arabic letters join)', () => {
    const css = parseCss(read(path.join(WEB_ROOT, 'styles/components.css')));
    const th = [...(css.get('|th') ?? [])].join(';');
    expect(th).not.toMatch(/letter-spacing|text-transform/);
    expect(th).toContain('font-size:14px');
  });
});
