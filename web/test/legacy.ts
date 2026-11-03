/**
 * Read-only access to the original dashboard (the visual source of truth, decision C-1) and a small CSS
 * reader, so the tests can prove the new styles are the original's rather than a look-alike.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const WEB_ROOT = path.resolve(__dirname, '..');

/** The original checked out beside saas-crm/ (a developer's machine). */
export const SIBLING_PUBLIC = path.resolve(WEB_ROOT, '../../lead-to-doctor/backend/public');
export const SIBLING_DESIGN_MD = path.resolve(SIBLING_PUBLIC, '../../DESIGN.md');
/** The frozen copy committed with the tests, for CI and any checkout without the original (see its README). */
export const FROZEN_DIR = path.join(__dirname, 'legacy-reference');

const siblingPresent = existsSync(path.join(SIBLING_PUBLIC, 'index.html'));

/** An explicit LEGACY_PUBLIC_DIR wins; then the original beside saas-crm/; then the frozen copy. */
export const LEGACY_PUBLIC = process.env.LEGACY_PUBLIC_DIR ?? (siblingPresent ? SIBLING_PUBLIC : FROZEN_DIR);
export const LEGACY_DESIGN_MD =
  process.env.LEGACY_DESIGN_MD ??
  (process.env.LEGACY_PUBLIC_DIR ? path.resolve(LEGACY_PUBLIC, '../../DESIGN.md') : siblingPresent ? SIBLING_DESIGN_MD : path.join(FROZEN_DIR, 'DESIGN.md'));

export function legacyAvailable() {
  return existsSync(path.join(LEGACY_PUBLIC, 'index.html'));
}

/** The parity tests are the point of this package: a missing reference is a failure, not a silent skip. */
export function requireLegacy() {
  if (!legacyAvailable()) {
    throw new Error(`Original dashboard not found at ${LEGACY_PUBLIC}. Set LEGACY_PUBLIC_DIR to its backend/public folder.`);
  }
}

export const read = (p: string) => readFileSync(p, 'utf8');
export const sha256 = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
export const legacyIndexHtml = () => read(path.join(LEGACY_PUBLIC, 'index.html'));
export const legacyAppJs = () => read(path.join(LEGACY_PUBLIC, 'app.js'));

export function legacyCss() {
  const html = legacyIndexHtml();
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!m) throw new Error('no <style> block in the legacy index.html');
  return m[1];
}

// ---------------------------------------------------------------------------------------------------------------
// Minimal CSS reader: rules keyed by "<media>|<selector>", each a set of "prop:value" declarations.
// At-rules that are not @media (@font-face, @keyframes) are kept whole under their own key.

export type RuleMap = Map<string, Set<string>>;

const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/\s*([,;:{}()>+~])\s*/g, '$1').trim();

function stripComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function splitBlocks(css: string): { head: string; body: string }[] {
  const out: { head: string; body: string }[] = [];
  let depth = 0;
  let start = 0;
  let headStart = 0;
  let head = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      if (depth === 0) {
        head = css.slice(headStart, i);
        start = i + 1;
      }
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        out.push({ head: head.trim(), body: css.slice(start, i) });
        headStart = i + 1;
      }
    }
  }
  return out;
}

function declarations(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const c of body) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ';' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += c;
  }
  parts.push(cur);
  return parts
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(':');
      return `${d.slice(0, i).trim().toLowerCase()}:${norm(d.slice(i + 1))}`;
    });
}

export function parseCss(css: string, media = ''): RuleMap {
  const rules: RuleMap = new Map();
  const add = (key: string, decls: string[]) => {
    const set = rules.get(key) ?? new Set<string>();
    decls.forEach((d) => set.add(d));
    rules.set(key, set);
  };
  for (const { head, body } of splitBlocks(stripComments(css))) {
    if (head.startsWith('@media')) {
      const inner = parseCss(body, `${media}${norm(head)}`);
      inner.forEach((v, k) => add(k, [...v]));
    } else if (head.startsWith('@')) {
      add(`${media}|${norm(head)}`, [norm(body)]);
    } else {
      const selector = head.split(',').map(norm).join(',');
      add(`${media}|${selector}`, declarations(body));
    }
  }
  return rules;
}

/** Custom properties (--x: value) declared by one rule. */
export function customProps(rules: RuleMap, key: string): Record<string, string> {
  const set = rules.get(key);
  if (!set) throw new Error(`rule not found: ${key}`);
  const out: Record<string, string> = {};
  for (const d of set) {
    if (d.startsWith('--')) {
      const i = d.indexOf(':');
      out[d.slice(0, i)] = d.slice(i + 1);
    }
  }
  return out;
}
