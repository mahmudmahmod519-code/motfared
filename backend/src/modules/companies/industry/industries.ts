/**
 * Industry templates: the words a company's dashboard uses and the optional features it starts with.
 *
 * The product began as a clinic call centre (Lead to Doctor); the same engine now serves any business. The
 * structure does not change between industries - only the words a person reads, and whether the clinic-only
 * features are offered. A company picks a template; the owner can then override any single word or feature.
 * Only the overrides are stored, so a template that gains a better word reaches every company that did not
 * choose its own.
 */

export const INDUSTRIES = ['clinic', 'kitchens', 'real_estate', 'sales', 'general'] as const;
export type Industry = (typeof INDUSTRIES)[number];
export const DEFAULT_INDUSTRY: Industry = 'clinic';

/** Every word the dashboard takes from the company, singular and plural where the screens need both. */
export const TERM_KEYS = [
  'unit', // the level leads and campaigns belong to: the original's doctor
  'units',
  'campaign',
  'campaigns',
  'client',
  'clients',
  'service',
  'services',
  'booking',
  'bookings',
  'attended', // what happened at the booking: the original's "examined"
  'rep',
  'reps',
  'team_lead',
  'plan', // the follow-up after a booking: the original's treatment plan
] as const;
export type TermKey = (typeof TERM_KEYS)[number];
export type Terms = Record<TermKey, string>;

/** The clinic-only parts of the original, offered per company. */
export const FEATURE_KEYS = [
  'plan_followup', // الخطة العلاجية: chasing a started plan after the visit
  'unit_report', // تقرير الدكتور: the printable report for the clinic
  'unit_portal', // لينك العيادة: the clinic's own read-only page
  'public_form', // /dr/<slug>: the public form that creates leads
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type Features = Record<FeatureKey, boolean>;

export const TERM_MAX_LENGTH = 40;

const COMMON = {
  campaign: 'كامبين',
  campaigns: 'الكامبينات',
  client: 'عميل',
  clients: 'العملاء',
  rep: 'سيلز',
  reps: 'السيلز',
  team_lead: 'رئيس فريق',
} as const;

const NO_CLINIC_FEATURES: Features = { plan_followup: false, unit_report: false, unit_portal: false, public_form: false };

export const PRESETS: Record<Industry, { label: string; terms: Terms; features: Features }> = {
  clinic: {
    label: 'عيادات ومراكز طبية',
    // The original dashboard's own words, so an existing clinic sees no change.
    terms: { ...COMMON, unit: 'دكتور', units: 'الدكاترة', service: 'خدمة', services: 'الخدمات', booking: 'حجز', bookings: 'الحجوزات', attended: 'اتكشف', plan: 'الخطة العلاجية' },
    features: { plan_followup: true, unit_report: true, unit_portal: true, public_form: true },
  },
  kitchens: {
    label: 'مطابخ وأثاث',
    terms: { ...COMMON, unit: 'فرع', units: 'الفروع', service: 'منتج', services: 'المنتجات', booking: 'معاينة', bookings: 'المعاينات', attended: 'اتعملت المعاينة', plan: 'متابعة التعاقد' },
    features: NO_CLINIC_FEATURES,
  },
  real_estate: {
    label: 'عقارات',
    terms: { ...COMMON, unit: 'مشروع', units: 'المشاريع', service: 'وحدة', services: 'الوحدات', booking: 'معاينة', bookings: 'المعاينات', attended: 'اتعملت المعاينة', plan: 'متابعة التعاقد' },
    features: NO_CLINIC_FEATURES,
  },
  sales: {
    label: 'مبيعات وخدمات',
    terms: { ...COMMON, unit: 'مشروع', units: 'المشاريع', service: 'خدمة', services: 'الخدمات', booking: 'ميعاد', bookings: 'المواعيد', attended: 'حضر الميعاد', plan: 'متابعة التعاقد' },
    features: NO_CLINIC_FEATURES,
  },
  general: {
    label: 'مجال تاني',
    terms: { ...COMMON, unit: 'قسم', units: 'الأقسام', service: 'خدمة', services: 'الخدمات', booking: 'ميعاد', bookings: 'المواعيد', attended: 'حضر الميعاد', plan: 'متابعة التعاقد' },
    features: NO_CLINIC_FEATURES,
  },
};

export const isIndustry = (v: unknown): v is Industry => typeof v === 'string' && (INDUSTRIES as readonly string[]).includes(v);

/** The industry a stored value means; anything unknown reads as the original product (clinic). */
export const industryOf = (v: unknown): Industry => (isIndustry(v) ? v : DEFAULT_INDUSTRY);

/** The words and features a company actually sees: its template, then its own overrides on top. */
export function effectiveProfile(industry: unknown, terms: unknown, features: unknown): { industry: Industry; terms: Terms; features: Features } {
  const key = industryOf(industry);
  const preset = PRESETS[key];
  const out = { industry: key, terms: { ...preset.terms }, features: { ...preset.features } };
  if (terms && typeof terms === 'object') {
    for (const k of TERM_KEYS) {
      const v = (terms as Record<string, unknown>)[k];
      if (typeof v === 'string' && v.trim()) out.terms[k] = v.trim();
    }
  }
  if (features && typeof features === 'object') {
    for (const k of FEATURE_KEYS) {
      const v = (features as Record<string, unknown>)[k];
      if (typeof v === 'boolean') out.features[k] = v;
    }
  }
  return out;
}

/**
 * Applies an owner's change to the stored overrides. A value sets that word or feature; `null` drops the
 * override so the template's value shows again. Returns the new overrides (null when none are left), or the
 * reason the change is refused, in the dashboard's Arabic.
 */
export function applyTermChanges(current: unknown, change: Record<string, unknown>): { ok: true; value: Partial<Terms> | null } | { ok: false; message: string } {
  const next: Partial<Terms> = { ...(current && typeof current === 'object' ? (current as Partial<Terms>) : {}) };
  for (const [k, v] of Object.entries(change)) {
    if (!(TERM_KEYS as readonly string[]).includes(k)) return { ok: false, message: `المصطلح "${k}" مش معروف` };
    const key = k as TermKey;
    if (v === null) {
      delete next[key];
      continue;
    }
    if (typeof v !== 'string' || !v.trim()) return { ok: false, message: 'المصطلح لازم يكون كلمة مش فاضية' };
    if (v.trim().length > TERM_MAX_LENGTH) return { ok: false, message: `المصطلح لازم يكون ${TERM_MAX_LENGTH} حرف أو أقل` };
    next[key] = v.trim();
  }
  return { ok: true, value: Object.keys(next).length ? next : null };
}

export function applyFeatureChanges(current: unknown, change: Record<string, unknown>): { ok: true; value: Partial<Features> | null } | { ok: false; message: string } {
  const next: Partial<Features> = { ...(current && typeof current === 'object' ? (current as Partial<Features>) : {}) };
  for (const [k, v] of Object.entries(change)) {
    if (!(FEATURE_KEYS as readonly string[]).includes(k)) return { ok: false, message: `الميزة "${k}" مش معروفة` };
    const key = k as FeatureKey;
    if (v === null) delete next[key];
    else if (typeof v === 'boolean') next[key] = v;
    else return { ok: false, message: 'الميزة لازم تكون شغالة أو مقفولة' };
  }
  return { ok: true, value: Object.keys(next).length ? next : null };
}

/** The template list for a sign-up or settings screen. */
export const industryList = () => INDUSTRIES.map((key) => ({ key, label: PRESETS[key].label, terms: PRESETS[key].terms, features: PRESETS[key].features }));
