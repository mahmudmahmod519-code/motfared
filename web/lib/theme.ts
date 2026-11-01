/**
 * Theme preference. The original dashboard only follows the system; the SaaS shell also lets a user
 * pin light or dark. "system" is the default, so nobody who never touches it sees a difference.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ltd-theme';

export function parsePreference(raw: unknown): ThemePreference {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export function effectiveTheme(pref: ThemePreference, systemDark: boolean): Theme {
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}

export function nextPreference(pref: ThemePreference): ThemePreference {
  return pref === 'system' ? 'light' : pref === 'light' ? 'dark' : 'system';
}

/**
 * Runs in <head> before first paint: applies a pinned choice as data-theme so the page never flashes the
 * wrong theme. Following the system needs no attribute (the CSS media query does it). Storage can be
 * blocked (private windows), so every access is guarded.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var e=document.documentElement;if(t==='light'||t==='dark'){e.setAttribute('data-theme',t)}else{e.removeAttribute('data-theme')}}catch(_){}})();`;
