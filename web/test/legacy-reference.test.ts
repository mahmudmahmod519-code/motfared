import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { FROZEN_DIR, sha256, SIBLING_DESIGN_MD, SIBLING_PUBLIC } from './legacy';

const FILES = ['index.html', 'app.js', 'fonts/IBMPlexSansArabic-Regular.woff2', 'fonts/IBMPlexSansArabic-SemiBold.woff2'];

/**
 * The parity tests read the original from beside saas-crm/ when it is there, and from the frozen copy
 * (test/legacy-reference) otherwise, as in CI. Both must be the same files, or CI would check against something
 * other than the original.
 */
describe('frozen copy of the original dashboard', () => {
  it('holds every file the parity tests read', () => {
    for (const f of [...FILES, 'DESIGN.md']) expect(existsSync(path.join(FROZEN_DIR, f)), f).toBe(true);
  });

  it.runIf(existsSync(path.join(SIBLING_PUBLIC, 'index.html')))('is byte-identical to the original beside saas-crm/', () => {
    for (const f of FILES) expect(sha256(path.join(FROZEN_DIR, f)), f).toBe(sha256(path.join(SIBLING_PUBLIC, f)));
    expect(sha256(path.join(FROZEN_DIR, 'DESIGN.md'))).toBe(sha256(SIBLING_DESIGN_MD));
  });
});
