import { describe, expect, it } from 'vitest';
import { NAV, groupedNav, localizeNav } from '../lib/nav';
import { readCompany } from '../lib/me';
import { ALL_FEATURES, CLINIC_TERMS, FEATURE_KEYS, TERM_KEYS, g, lil, readTerms, withAl, withoutAl } from '../lib/terms';
// The backend's templates are plain TypeScript with no imports: the web's copy is checked against them. Imported
// by a computed path so `next build` (which type-checks this folder but, in Docker, has no backend/ beside it)
// never tries to resolve it; vitest loads it at run time.
const BACKEND_INDUSTRIES = '../../backend/src/modules/companies/industry/industries';
const backend: any = await import(/* @vite-ignore */ BACKEND_INDUSTRIES);

const company = (industry: string) => ({ terms: { ...backend.PRESETS[industry].terms }, features: { ...backend.PRESETS[industry].features } });

describe('the web and the API agree on the words', () => {
  it('same keys, and the fallback words are the API\'s clinic template', () => {
    expect([...TERM_KEYS]).toEqual([...backend.TERM_KEYS]);
    expect([...FEATURE_KEYS]).toEqual([...backend.FEATURE_KEYS]);
    expect(CLINIC_TERMS).toEqual(backend.PRESETS.clinic.terms);
    expect(ALL_FEATURES).toEqual(backend.PRESETS.clinic.features);
  });
});

describe('Arabic helpers', () => {
  it('adds and removes the article, joins ل', () => {
    expect(withAl('دكتور')).toBe('الدكتور');
    expect(withAl('الدكتور')).toBe('الدكتور');
    expect(withAl('نوع مطبخ')).toBe('نوع مطبخ');
    expect(withoutAl('الدكاترة')).toBe('دكاترة');
    expect(withoutAl('دكاترة')).toBe('دكاترة');
    expect(lil('دكتور')).toBe('للدكتور');
    expect(lil('فرع')).toBe('للفرع');
  });
  it('agrees with a feminine word (ending in ة)', () => {
    expect(g('خدمة', 'جديد', 'جديدة')).toBe('جديدة');
    expect(g('منتج', 'جديد', 'جديدة')).toBe('جديد');
    expect(g('معاينة', 'شغّال', 'شغّالة')).toBe('شغّالة');
  });
});

describe('localizeNav: the menu in the company\'s words', () => {
  it('a clinic sees exactly the original menu (no change for existing companies)', () => {
    expect(localizeNav(NAV, company('clinic'))).toEqual(NAV);
    expect(localizeNav(NAV, null)).toBe(NAV);
  });

  it('a kitchen company sees its own words and no clinic-only pages', () => {
    const nav = localizeNav(NAV, company('kitchens'));
    const label = (id: string) => nav.find((n) => n.id === id)?.label;
    expect(label('doctors')).toBe('الفروع والكامبينات');
    expect(label('bookings')).toBe('المعاينات والتذكيرات');
    expect(label('services')).toBe('المنتجات');
    expect(nav.map((n) => n.id)).not.toContain('plan-start');
    expect(nav.map((n) => n.id)).not.toContain('doctor-report');
    expect(JSON.stringify(nav)).not.toMatch(/دكتور|دكاترة|علاج/);
    // the groups survive the hidden pages
    expect(groupedNav(nav).map((g) => g.title)).toEqual([null, 'الشغل اليومي', 'الفريق', 'البيانات', 'المالية', 'الإعدادات']);
  });

  it('a feature the owner switches back on brings its page back, in the company\'s words', () => {
    const c = company('kitchens');
    c.features.unit_report = true;
    c.terms.unit = 'معرض';
    expect(localizeNav(NAV, c).find((n) => n.id === 'doctor-report')?.label).toBe('تقرير المعرض');
  });
});

describe('readCompany: the company block of /auth/me', () => {
  it('no block (a platform admin, an older API) means no company', () => {
    expect(readCompany(undefined)).toBeNull();
    expect(readCompany({ name: 'x' })).toBeNull();
  });
  it('missing or malformed words fall back to the clinic words; only an https logo is kept', () => {
    const c = readCompany({ id: 'c1', name: 'مطابخ النور', logo_url: 'http://x/logo.png', terms: { unit: 'فرع', units: 5, client: '  ' }, features: { public_form: 'yes', unit_report: false } })!;
    expect(c.logo_url).toBeNull();
    expect(c.terms.unit).toBe('فرع');
    expect(c.terms.units).toBe('الدكاترة');
    expect(c.terms.client).toBe('عميل');
    expect(c.features).toEqual({ ...ALL_FEATURES, unit_report: false });
    expect(readCompany({ id: 'c1', logo_url: 'https://cdn.x/l.png' })!.logo_url).toBe('https://cdn.x/l.png');
    expect(readTerms(null)).toEqual(CLINIC_TERMS);
  });
});
