import { latinDigits, toLocalEgyptian } from './phone';

/**
 * The one shape a phone number is compared in, whichever side it came from (ported from the legacy
 * backend). An Egyptian mobile is `01[0125]` + 8 digits, so the operator prefix lives in exactly the two
 * digits a last-8 comparison would throw away: 01011110001 and 01511110001 are different people.
 * toLocalEgyptian also folds `+20`/`0020`/Arabic-Indic digits into the same `01…` leads are stored in.
 * Anything not Egyptian keeps its country code, minus the `00`, and no plus.
 */
export function callPhoneKey(value: unknown): string {
  const local = toLocalEgyptian(value);
  if (local) return local;
  const digits = latinDigits(value).replace(/\D/g, '');
  return digits.startsWith('00') ? digits.slice(2) : digits;
}

/**
 * The last ten digits of a number, a net under the comparison for stored values that differ from the key
 * only by a leading zero or a country code. Ten and not eight, so the Egyptian operator prefix stays inside.
 */
export function callPhoneTail(value: unknown): string | null {
  const digits = latinDigits(value).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** Both comparison forms for a set of numbers, deduplicated and ready for an `IN (…)`. */
export function phoneMatchSets(phones: unknown): { keys: string[]; tails: string[] } {
  const list = (Array.isArray(phones) ? phones : [phones]).filter((p) => String(p ?? '').trim());
  return {
    keys: [...new Set(list.map(callPhoneKey).filter(Boolean))],
    tails: [...new Set(list.map(callPhoneTail).filter((t): t is string => !!t))],
  };
}
