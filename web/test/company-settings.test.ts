import { describe, expect, it } from 'vitest';
import { buildChanges, fromProfile } from '../lib/company-settings';
import { ALL_FEATURES, CLINIC_TERMS } from '../lib/terms';
import type { CompanyProfileDetails, IndustryTemplate } from '../lib/types';

const clinic: IndustryTemplate = { key: 'clinic', label: 'عيادات', terms: CLINIC_TERMS, features: ALL_FEATURES };
const kitchens: IndustryTemplate = {
  key: 'kitchens',
  label: 'مطابخ',
  terms: { ...CLINIC_TERMS, unit: 'فرع', units: 'الفروع', service: 'منتج', services: 'المنتجات' },
  features: { plan_followup: false, unit_report: false, unit_portal: false, public_form: false },
};
const profile = (over: Partial<CompanyProfileDetails> = {}): CompanyProfileDetails => ({
  id: 'c1', name: 'الأمل', logo_url: null, industry: 'clinic', industry_label: 'عيادات',
  terms: CLINIC_TERMS, features: ALL_FEATURES, overrides: { terms: {}, features: {} }, ...over,
});

describe('company settings: what Save sends', () => {
  it('nothing changed, nothing sent', () => {
    const p = profile();
    expect(buildChanges(p, fromProfile(p), clinic)).toEqual({});
  });

  it('sends a trimmed name, an emptied logo as null, a new industry', () => {
    const p = profile({ logo_url: 'https://x/l.png' });
    const f = { ...fromProfile(p), name: '  مطابخ النور ', logo: '  ', industry: 'kitchens' };
    f.features = { ...kitchens.features };
    expect(buildChanges(p, f, kitchens)).toEqual({ name: 'مطابخ النور', logo_url: null, industry: 'kitchens' });
  });

  it('a typed word becomes an override; the template\'s own word or an empty box clears one', () => {
    const p = profile({ overrides: { terms: { unit: 'عيادة', client: 'مريض' }, features: {} } });
    const f = fromProfile(p);
    expect(f.terms.unit).toBe('عيادة');
    f.terms = { ...f.terms, unit: ' دكتور ', client: '', services: 'العلاجات' };
    expect(buildChanges(p, f, clinic)).toEqual({ terms: { unit: null, client: null, services: 'العلاجات' } });
  });

  it('a feature set like the template sends null; one set against it sends the value', () => {
    const p = profile({ industry: 'kitchens', features: { ...kitchens.features, public_form: true }, overrides: { terms: {}, features: { public_form: true } } });
    const f = fromProfile(p);
    f.features = { ...f.features, public_form: false, unit_report: true };
    expect(buildChanges(p, f, kitchens)).toEqual({ features: { public_form: null, unit_report: true } });
  });
});
