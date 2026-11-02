import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { legacyCss, parseCss, read, requireLegacy, WEB_ROOT } from './legacy';

/** pages.css has no allowlist: every declaration in it must be the original's, as written there. */
describe('page stylesheet comes from the original dashboard', () => {
  const ours = () => parseCss(read(path.join(WEB_ROOT, 'components', 'pages', 'pages.css')));

  it('ships the rules the services, doctors and accounts pages use', () => {
    const o = ours();
    for (const key of ['|.svc-list', '|.svc-row', '|.svc-add', '|.svc-actions', '|.doctors-table th,.doctors-table td', '|.doctors-table .actions', '|.inactive-row td']) {
      expect(o.has(key), `missing rule ${key}`).toBe(true);
    }
    expect(o.has('@media(max-width:560px)|.svc-row')).toBe(true);
  });

  it('every declaration is the original\'s', () => {
    requireLegacy();
    const l = parseCss(legacyCss());
    const foreign: string[] = [];
    for (const [key, decls] of ours()) for (const d of decls) if (!l.get(key)?.has(d)) foreign.push(`${key} { ${d} }`);
    expect(foreign).toEqual([]);
  });
});
