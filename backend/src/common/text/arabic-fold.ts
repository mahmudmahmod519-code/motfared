/**
 * Arabic the way people type it, not the way it is spelled (ported from the legacy backend).
 *
 * A rep writes "عبد الله سيد" and the lead is saved "عبدالله سيد"; another types "هبه" where the
 * name is "هبة". Both were unfindable, so both sides of every name comparison are folded: spaces and
 * the tatweel dropped, the alef's hamza forms and the two ya forms and ة/ه made one letter, the
 * diacritics dropped, Latin lower-cased. Digits are untouched (they have their own digits-only match).
 */
const ARABIC_FOLD: [string, string][] = [
  [' ', ''], ['\t', ''], ['ـ', ''],
  ['أ', 'ا'], ['إ', 'ا'], ['آ', 'ا'], ['ٱ', 'ا'], ['ء', ''],
  ['ى', 'ي'], ['ی', 'ي'], ['ئ', 'ي'], ['ؤ', 'و'], ['ة', 'ه'],
  ['ً', ''], ['ٌ', ''], ['ٍ', ''], ['َ', ''], ['ُ', ''],
  ['ِ', ''], ['ّ', ''], ['ْ', ''], ['ٰ', ''],
];

/** The folding as a SQL expression, so MySQL can match on it. The replacements are constants, never user input. */
export function foldSql(expr: string): string {
  let out = `LOWER(COALESCE(${expr}, ''))`;
  for (const [from, to] of ARABIC_FOLD) out = `REPLACE(${out}, '${from}', '${to}')`;
  return out;
}

/** The same folding in JavaScript, for what the user typed. */
export function foldText(text: unknown): string {
  let out = String(text ?? '').toLowerCase();
  for (const [from, to] of ARABIC_FOLD) out = out.split(from).join(to);
  return out;
}

/** Escapes LIKE wildcards in user input so "50%" or "a_b" match literally. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (m) => `\\${m}`);
}
