/**
 * Returns a configured secret, or undefined when it is missing or still a placeholder
 * (e.g. `whsec_...`, `...`, `change-me`). Callers must fail closed on undefined.
 */
export function configuredSecret(value: string | undefined | null): string | undefined {
  const v = (value ?? '').trim();
  if (v.length < 16) return undefined;
  if (/\.\.\.$/.test(v) || /change[-_ ]?me|placeholder|example|your[-_ ]/i.test(v)) return undefined;
  return v;
}
