import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { legacyCss, parseCss, read, requireLegacy, RuleMap, WEB_ROOT } from './legacy';

/** Every stylesheet of the design system except the tokens (they have their own, stricter test). */
const FILES = ['base.css', 'components.css', 'shell.css'];
const stylesDir = path.join(WEB_ROOT, 'styles');
const ours = (): RuleMap => parseCss(FILES.map((f) => read(path.join(stylesDir, f))).join('\n'));
const legacy = (): RuleMap => (requireLegacy(), parseCss(legacyCss()));

/**
 * Declarations that exist in our CSS but not in the original, each with the reason. Everything else
 * must be the original's, character for character. A stale entry (no longer in our CSS) fails too.
 */
const INTENTIONAL: { key: string; decl: string; why: string }[] = [
  { key: '|th,td', decl: 'text-align:start', why: 'logical equivalent of the original text-align:right in an RTL document' },
  { key: '|.field', decl: 'text-align:start', why: 'logical equivalent of text-align:right' },
  { key: '|.nav-item', decl: 'text-align:start', why: 'logical equivalent of text-align:right' },
  { key: '|.nav-item', decl: 'text-decoration:none', why: 'the original\'s nav items are buttons; ours are links, which must not be underlined' },
  { key: '|.nav-item', decl: 'line-height:normal', why: 'a <button> has line-height:normal by default; an <a> would inherit 1.55 and be taller than the original' },
  { key: '|.page-enter', decl: 'animation:view-in 320ms cubic-bezier(0.16,1,0.3,1)', why: 'Next.js route change: the original toggled .view.active, which has the same animation' },
  { key: '@media(max-width:860px)|.sidebar', decl: 'inset-inline-start:0', why: 'logical equivalent of right:0: in a right-to-left document the right edge is the inline-start edge' },
  { key: '@media(max-width:860px)|.sidebar', decl: 'inset-inline-end:auto', why: 'logical equivalent of left:auto' },
  { key: '@media(max-width:860px)|:root[dir="ltr"] .sidebar', decl: 'transform:translateX(-100%)', why: 'mirror of the drawer for a left-to-right document (unused by the Arabic product; direction is never hard-coded)' },
  { key: '@media(max-width:860px)|:root[dir="ltr"] .sidebar.open', decl: 'transform:translateX(0)', why: 'mirror of the open drawer' },
  { key: '@media(prefers-reduced-motion:reduce)|.page-enter', decl: 'animation:none', why: 'the original switched off .view.active; this is the same rule for the Next.js page wrapper' },
];

const isAllowed = (key: string, decl: string) => INTENTIONAL.some((i) => i.key === key && i.decl === decl);

describe('base, component and shell CSS come from the original dashboard', () => {
  it('ships at least the rules the shell needs', () => {
    const o = ours();
    for (const key of [
      '|.shell', '|.sidebar', '|.topbar', '|.nav-item', '|.nav-group', '|.content', '|.card', '|.tile', '|.badge', '|th', '|td',
      '|button', '|button.primary', '|.toast', '|.modal', '|.empty', '|.toolbar', '|body', '|:focus-visible',
    ]) {
      expect(o.has(key), `missing rule ${key}`).toBe(true);
    }
  });

  it('every declaration is the original\'s unless it is on the justified allowlist', () => {
    const l = legacy();
    const o = ours();
    const foreign: string[] = [];
    for (const [key, decls] of o) {
      // the pieces the original does not have as such are covered by the allowlist entries
      const original = l.get(key);
      for (const d of decls) {
        if (original?.has(d)) continue;
        if (isAllowed(key, d)) continue;
        foreign.push(`${key} { ${d} }`);
      }
    }
    expect(foreign).toEqual([]);
  });

  it('the drawer sits on the same side as the original: right:0 is the inline-START edge in RTL (not the end)', () => {
    const original = legacy().get('@media(max-width:860px)|.sidebar')!;
    expect(original.has('right:0') && original.has('left:auto')).toBe(true);
    const mine = ours().get('@media(max-width:860px)|.sidebar')!;
    expect(mine.has('inset-inline-start:0')).toBe(true);
    expect(mine.has('inset-inline-end:auto')).toBe(true);
    expect(mine.has('inset-inline-end:0')).toBe(false);
  });

  it('the allowlist has no stale entries', () => {
    const o = ours();
    for (const i of INTENTIONAL) expect(o.get(i.key)?.has(i.decl), `${i.key} { ${i.decl} } is not in our CSS any more`).toBe(true);
  });

  it('at-rules (@font-face, @keyframes) are the original\'s', () => {
    const l = legacy();
    const o = ours();
    for (const [key, decls] of o) {
      if (!key.split('|')[1]?.startsWith('@')) continue;
      expect([key, [...decls]]).toEqual([key, [...(l.get(key) ?? [])]]);
    }
  });

  it('contains no stylesheet we forgot to check', () => {
    expect(readdirSync(stylesDir).filter((f) => f.endsWith('.css')).sort()).toEqual([...FILES, 'tokens.css'].sort());
  });
});

