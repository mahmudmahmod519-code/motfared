/**
 * The company's own words (GET /api/auth/me → company.terms) and the small amount of Arabic grammar needed to
 * put them into the original's sentences. With the clinic template every sentence comes out exactly as the
 * original dashboard wrote it; another industry gets the same sentence with its own words.
 */

export const TERM_KEYS = [
  'unit', 'units', 'campaign', 'campaigns', 'client', 'clients', 'service', 'services',
  'booking', 'bookings', 'attended', 'rep', 'reps', 'team_lead', 'plan',
] as const;
export type TermKey = (typeof TERM_KEYS)[number];
export type Terms = Record<TermKey, string>;

export const FEATURE_KEYS = ['plan_followup', 'unit_report', 'unit_portal', 'public_form'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type Features = Record<FeatureKey, boolean>;

/** The clinic template (backend industry/industries.ts): the original's words, used when the API sends none. */
export const CLINIC_TERMS: Terms = {
  unit: 'دكتور', units: 'الدكاترة', campaign: 'كامبين', campaigns: 'الكامبينات', client: 'عميل', clients: 'العملاء',
  service: 'خدمة', services: 'الخدمات', booking: 'حجز', bookings: 'الحجوزات', attended: 'اتكشف',
  rep: 'سيلز', reps: 'السيلز', team_lead: 'رئيس فريق', plan: 'الخطة العلاجية',
};
export const ALL_FEATURES: Features = { plan_followup: true, unit_report: true, unit_portal: true, public_form: true };

const AL = 'ال';

/** "دكتور" → "الدكتور"; a word that already has the article, or several words, is left as it is. */
export const withAl = (w: string) => (w.startsWith(AL) || /\s/.test(w) ? w : AL + w);

/** "الدكاترة" → "دكاترة" (for "مفيش دكاترة لسه"). */
export const withoutAl = (w: string) => (w.startsWith(AL) && w.length > AL.length + 1 ? w.slice(AL.length) : w);

/** "دكتور" → "للدكتور": the preposition ل joined to the word with its article. */
export const lil = (w: string) => 'ل' + withAl(w).replace(/^ا/, '');

/** A word ending in ة is treated as feminine (خدمة، معاينة), everything else as masculine (منتج، فرع). */
export const isFeminine = (w: string) => /ة$/.test(w.trim().split(/\s+/)[0] ?? '');

/** Picks the masculine or feminine form of a word that agrees with `w`: g('خدمة', 'جديد', 'جديدة') → 'جديدة'. */
export const g = (w: string, masculine: string, feminine: string) => (isFeminine(w) ? feminine : masculine);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads terms from the API, falling back to the clinic words for anything missing or malformed. */
export function readTerms(raw: unknown): Terms {
  const out = { ...CLINIC_TERMS };
  if (isObject(raw)) for (const k of TERM_KEYS) if (typeof raw[k] === 'string' && (raw[k] as string).trim()) out[k] = (raw[k] as string).trim();
  return out;
}

export function readFeatures(raw: unknown): Features {
  const out = { ...ALL_FEATURES };
  if (isObject(raw)) for (const k of FEATURE_KEYS) if (typeof raw[k] === 'boolean') out[k] = raw[k] as boolean;
  return out;
}
