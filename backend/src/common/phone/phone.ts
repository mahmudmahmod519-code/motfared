/**
 * Phone canonicalisation, ported from the legacy backend (lead-to-doctor/backend/src/phone.js)
 * so mobile logins and the SaaS user table agree with the numbers the app and its leads use.
 *
 * Two canonical forms: an Egyptian number is `01xxxxxxxxx`; every other Arab country's is
 * `+<code><number>`. Returns null rather than guessing: a wrong number is worse than a
 * rejected one.
 */

const EGYPT_PHONE_RE = /^01[0125]\d{8}$/;

const ARAB_COUNTRIES: { code: string; lengths: number[]; first: RegExp }[] = [
  { code: '249', lengths: [9], first: /^[19]/ },
  { code: '966', lengths: [9], first: /^5/ },
  { code: '971', lengths: [9], first: /^5/ },
  { code: '965', lengths: [8], first: /^[569]/ },
  { code: '974', lengths: [8], first: /^[3567]/ },
  { code: '973', lengths: [8], first: /^[36]/ },
  { code: '968', lengths: [8], first: /^[79]/ },
  { code: '962', lengths: [9], first: /^7/ },
  { code: '961', lengths: [7, 8], first: /^[378]/ },
  { code: '963', lengths: [9], first: /^9/ },
  { code: '964', lengths: [10], first: /^7/ },
  { code: '970', lengths: [9], first: /^5/ },
  { code: '972', lengths: [9], first: /^5/ },
  { code: '967', lengths: [9], first: /^7/ },
  { code: '218', lengths: [9], first: /^9/ },
  { code: '216', lengths: [8], first: /^[2459]/ },
  { code: '213', lengths: [9], first: /^[567]/ },
  { code: '212', lengths: [9], first: /^[67]/ },
  { code: '222', lengths: [8], first: /^[234]/ },
  { code: '252', lengths: [8, 9], first: /^[69]/ },
  { code: '253', lengths: [8], first: /^7/ },
  { code: '269', lengths: [7], first: /^[34]/ },
];

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

/** Rewrites Arabic-Indic and Persian digits as Latin ones. */
export function latinDigits(value: unknown): string {
  return String(value ?? '').replace(/[٠-٩۰-۹]/g, (d) => {
    const arabic = ARABIC_INDIC.indexOf(d);
    return String(arabic >= 0 ? arabic : EASTERN_ARABIC_INDIC.indexOf(d));
  });
}

export function toLocalEgyptian(value: unknown): string | null {
  let digits = latinDigits(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('20')) {
    digits = digits.slice(2);
    if (!digits.startsWith('0')) digits = `0${digits}`; // `+2001…` carries a stray zero already
  }
  if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`; // spreadsheet dropped the zero
  return EGYPT_PHONE_RE.test(digits) ? digits : null;
}

function toForeign(value: unknown): string | null {
  let digits = latinDigits(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  for (const country of ARAB_COUNTRIES) {
    if (!digits.startsWith(country.code)) continue;
    let rest = digits.slice(country.code.length);
    const longest = Math.max(...country.lengths);
    if (rest.length === longest + 1 && rest.startsWith('0')) rest = rest.slice(1);
    if (!country.lengths.includes(rest.length) || !country.first.test(rest)) return null;
    return `+${country.code}${rest}`;
  }
  return null;
}

/** The one canonical form of a phone number, or null when it is not a recognisable one. */
export function toCanonicalPhone(value: unknown): string | null {
  return toLocalEgyptian(value) || toForeign(value);
}

// ───────────────────────────── free-text extraction ─────────────────────────────

/** How much of a cell the word scan looks at: the slice search is cubic in the number of words. */
const MAX_SCAN_CHARS = 64;
/** The most number-shaped words one run may span. "010 2318 8094" is three; six is generous. */
const MAX_RUN_WORDS = 6;

/**
 * Like toCanonicalPhone, but tolerant of a number typed alongside other text ("ده رقمي اتصل بيا
 * 010 2318 8094"), which a form or a rep produces. Looks for a run of number-shaped *words*, so stray
 * digits elsewhere in the sentence never merge into the real number. Punctuation (including the
 * Arabic comma and semicolon) separates two numbers, and the first is read; a cut that lands in the
 * middle of a number is dropped rather than read as a different number.
 */
export function extractPhone(value: unknown): string | null {
  const direct = toCanonicalPhone(value);
  if (direct) return direct;

  const isNumberShaped = (w: string) => /^[\d+-]+$/.test(w);
  const scanned = latinDigits(value).replace(/[,;|/\\\n\r،؛]+/g, ' ');
  const words = scanned.slice(0, MAX_SCAN_CHARS).trim().split(/\s+/).filter(Boolean);
  if (scanned.length > MAX_SCAN_CHARS && !/\s/.test(scanned[MAX_SCAN_CHARS])) words.pop();

  let i = 0;
  while (i < words.length) {
    if (!isNumberShaped(words[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < words.length && j - i + 1 < MAX_RUN_WORDS && isNumberShaped(words[j + 1])) j++;
    // Every contiguous slice of the run, widest first: a stray digit tacked onto one edge is far more
    // common than the number itself being split into non-adjacent pieces.
    for (let width = j - i + 1; width >= 1; width--) {
      for (let start = i; start + width - 1 <= j; start++) {
        const candidate = toCanonicalPhone(words.slice(start, start + width).join(''));
        if (candidate) return candidate;
      }
    }
    i = j + 1;
  }
  return null;
}
