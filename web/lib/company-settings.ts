import { FEATURE_KEYS, TERM_KEYS, type Features, type TermKey } from './terms';
import type { CompanyProfileDetails, IndustryTemplate } from './types';

/** The company settings form (/settings/company): its state and the PATCH /api/company-profile body it sends. */

export interface FormState {
  name: string;
  logo: string;
  industry: string;
  /** What is typed in each word's box: empty = the template's word. */
  terms: Record<TermKey, string>;
  features: Features;
}

export const fromProfile = (p: CompanyProfileDetails): FormState => ({
  name: p.name,
  logo: p.logo_url ?? '',
  industry: p.industry,
  terms: Object.fromEntries(TERM_KEYS.map((k) => [k, p.overrides.terms[k] ?? ''])) as Record<TermKey, string>,
  features: { ...p.features },
});

/**
 * The PATCH body for what changed. A word equal to the template's, or left empty, goes back to the template
 * (null); so does a feature switched to the template's own setting. Unchanged keys are not sent.
 */
export function buildChanges(initial: CompanyProfileDetails, form: FormState, template: IndustryTemplate): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (form.name.trim() !== initial.name) body.name = form.name.trim();
  const logo = form.logo.trim() || null;
  if (logo !== (initial.logo_url ?? null)) body.logo_url = logo;
  if (form.industry !== initial.industry) body.industry = form.industry;

  const terms: Record<string, string | null> = {};
  for (const k of TERM_KEYS) {
    const typed = form.terms[k].trim();
    const wanted = typed && typed !== template.terms[k] ? typed : undefined;
    if (wanted !== initial.overrides.terms[k]) terms[k] = wanted ?? null;
  }
  if (Object.keys(terms).length) body.terms = terms;

  const features: Record<string, boolean | null> = {};
  for (const k of FEATURE_KEYS) {
    const wanted = form.features[k] !== template.features[k] ? form.features[k] : undefined;
    if (wanted !== initial.overrides.features[k]) features[k] = wanted ?? null;
  }
  if (Object.keys(features).length) body.features = features;
  return body;
}
