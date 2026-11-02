import { applyFeatureChanges, applyTermChanges, effectiveProfile, FEATURE_KEYS, INDUSTRIES, PRESETS, TERM_KEYS, TERM_MAX_LENGTH } from './industries';

describe('industry templates', () => {
  it('every template defines every word and every feature', () => {
    for (const i of INDUSTRIES) {
      expect(Object.keys(PRESETS[i].terms).sort()).toEqual([...TERM_KEYS].sort());
      expect(Object.keys(PRESETS[i].features).sort()).toEqual([...FEATURE_KEYS].sort());
      for (const w of Object.values(PRESETS[i].terms)) expect(w.length).toBeLessThanOrEqual(TERM_MAX_LENGTH);
    }
  });

  it('the clinic template is the original dashboard: its words, all clinic features on', () => {
    expect(PRESETS.clinic.terms).toMatchObject({ unit: 'دكتور', units: 'الدكاترة', clients: 'العملاء', plan: 'الخطة العلاجية', services: 'الخدمات' });
    expect(Object.values(PRESETS.clinic.features).every(Boolean)).toBe(true);
  });

  it('other industries do not inherit medical words or clinic features', () => {
    for (const i of INDUSTRIES.filter((x) => x !== 'clinic')) {
      expect(JSON.stringify(PRESETS[i].terms)).not.toMatch(/دكتور|دكاترة|عيادة|علاج|اتكشف/);
      expect(Object.values(PRESETS[i].features).some(Boolean)).toBe(false);
    }
  });
});

describe('effectiveProfile', () => {
  it('an unknown or missing industry reads as clinic (the original product)', () => {
    expect(effectiveProfile(null, null, null).industry).toBe('clinic');
    expect(effectiveProfile('doctor', null, null).industry).toBe('clinic');
  });

  it('overrides win over the template; blank or wrong-typed overrides are ignored', () => {
    const p = effectiveProfile('kitchens', { unit: ' معرض ', units: '', bogus: 'x' }, { plan_followup: true, unit_report: 'yes' });
    expect(p.terms.unit).toBe('معرض');
    expect(p.terms.units).toBe('الفروع');
    expect((p.terms as any).bogus).toBeUndefined();
    expect(p.features.plan_followup).toBe(true);
    expect(p.features.unit_report).toBe(false);
  });
});

describe('applying an owner\'s changes', () => {
  it('sets, trims and resets words; null drops the override', () => {
    const a = applyTermChanges(null, { unit: '  معرض ', client: 'زبون' });
    expect(a).toEqual({ ok: true, value: { unit: 'معرض', client: 'زبون' } });
    const b = applyTermChanges((a as any).value, { unit: null });
    expect(b).toEqual({ ok: true, value: { client: 'زبون' } });
    expect(applyTermChanges({ client: 'زبون' }, { client: null })).toEqual({ ok: true, value: null });
  });

  it('refuses unknown keys, empty words and words that are too long', () => {
    expect(applyTermChanges(null, { doctor: 'x' }).ok).toBe(false);
    expect(applyTermChanges(null, { unit: '   ' }).ok).toBe(false);
    expect(applyTermChanges(null, { unit: 5 }).ok).toBe(false);
    expect(applyTermChanges(null, { unit: 'x'.repeat(TERM_MAX_LENGTH + 1) }).ok).toBe(false);
  });

  it('switches features on and off, resets with null, refuses anything else', () => {
    expect(applyFeatureChanges(null, { public_form: true })).toEqual({ ok: true, value: { public_form: true } });
    expect(applyFeatureChanges({ public_form: true }, { public_form: null })).toEqual({ ok: true, value: null });
    expect(applyFeatureChanges(null, { payroll: true }).ok).toBe(false);
    expect(applyFeatureChanges(null, { public_form: 'on' }).ok).toBe(false);
  });
});
