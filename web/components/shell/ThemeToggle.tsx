'use client';

import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY, ThemePreference, nextPreference, parsePreference } from '../../lib/theme';

const LABELS: Record<ThemePreference, string> = { system: 'تلقائي', light: 'فاتح', dark: 'غامق' };

/** Cycles system → light → dark. "system" (the default) leaves the choice to the device, as the original does. */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    try {
      setPref(parsePreference(localStorage.getItem(THEME_STORAGE_KEY)));
    } catch {
      /* storage blocked: stay on the system theme */
    }
  }, []);

  const choose = () => {
    const next = nextPreference(pref);
    setPref(next);
    const root = document.documentElement;
    if (next === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* the choice still applies for this page view */
    }
  };

  return (
    <button type="button" onClick={choose} title="المظهر" aria-label={`المظهر: ${LABELS[pref]}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      {LABELS[pref]}
    </button>
  );
}
