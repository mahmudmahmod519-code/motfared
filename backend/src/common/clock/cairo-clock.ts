/**
 * The business clock: everything that means "today", "this hour" or "this month" is decided on
 * Cairo wall time, whatever the server's own timezone happens to be. Ported from the legacy
 * backend's clock.js.
 *
 * The offset is read from Intl for the specific instant being asked about, not a fixed +3,
 * because Egypt has had daylight saving again since 2023 and is UTC+2 for half the year.
 *
 * Legacy timestamps are UTC text ('YYYY-MM-DD HH:MM:SS'); the MySQL-backed code works with Date
 * objects. The helpers here accept both (text is read as UTC, as the legacy backend wrote it).
 */

export const TIME_ZONE = 'Africa/Cairo';

export type Stamp = Date | string | number | null | undefined;

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export interface CairoParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The Cairo wall-clock fields for an instant. */
export function cairoParts(date: Date = new Date()): CairoParts {
  const out: Record<string, number> = {};
  for (const { type, value } of partsFormatter.formatToParts(date)) {
    if (type !== 'literal') out[type] = Number(value);
  }
  // Some ICU builds print midnight as "24" under hour12:false; the day part is already right.
  out.hour = out.hour % 24;
  return out as unknown as CairoParts;
}

const p = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' in Cairo for an instant. */
export function cairoDay(date: Date = new Date()): string {
  const { year, month, day } = cairoParts(date);
  return `${year}-${p(month)}-${p(day)}`;
}

/** 0..23, the hour in Cairo for an instant. */
export function cairoHour(date: Date = new Date()): number {
  return cairoParts(date).hour;
}

/** 'YYYY-MM' in Cairo for an instant. */
export function cairoMonth(date: Date = new Date()): string {
  return cairoDay(date).slice(0, 7);
}

/** Cairo's offset from UTC, in ms, at a given instant. Positive east of Greenwich. */
export function cairoOffsetMs(date: Date): number {
  const { year, month, day, hour, minute, second } = cairoParts(date);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000; // the parts carry no sub-second precision
}

/**
 * The instant (a UTC Date) at which a Cairo wall time happens: guess the offset from the wall
 * time read as if it were UTC, then check it against the offset at the resulting instant; the two
 * differ only across a DST switch and one correction settles it.
 */
export function cairoDateTime(dayStr: string, time = '00:00'): Date {
  const [y, m, d] = String(dayStr).split('-').map(Number);
  const [hh, mm, ss = 0] = String(time).split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm, ss);
  let guess = new Date(wall - cairoOffsetMs(new Date(wall)));
  const correction = cairoOffsetMs(guess);
  if (wall - correction !== guess.getTime()) guess = new Date(wall - correction);
  return guess;
}

/** A Date rendered the way SQLite's datetime('now') wrote it: 'YYYY-MM-DD HH:MM:SS' UTC. */
export function sqlStamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/** 'YYYY-MM-DD' plus a number of days, done on the calendar rather than on instants. */
export function addDays(dayStr: string, days: number): string {
  const [y, m, d] = String(dayStr).split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}`;
}

/** The UTC range [startUtc, endUtc) covering one Cairo calendar day, as legacy SQL stamps. */
export function cairoDayBounds(dayStr: string) {
  return {
    startUtc: sqlStamp(cairoDateTime(dayStr, '00:00')),
    endUtc: sqlStamp(cairoDateTime(addDays(dayStr, 1), '00:00')),
  };
}

/** The same half-open range as Dates, for comparing against MySQL timestamp columns. */
export function cairoDayRange(dayStr: string): { start: Date; end: Date } {
  return { start: cairoDateTime(dayStr, '00:00'), end: cairoDateTime(addDays(dayStr, 1), '00:00') };
}

/** The UTC range [startUtc, endUtc) covering one Cairo calendar month ('YYYY-MM'), as legacy SQL stamps. */
export function cairoMonthBounds(monthStr: string) {
  const [y, m] = String(monthStr).split('-').map(Number);
  const first = `${y}-${p(m)}-01`;
  const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${p(m + 1)}-01`;
  return {
    startUtc: sqlStamp(cairoDateTime(first, '00:00')),
    endUtc: sqlStamp(cairoDateTime(nextFirst, '00:00')),
  };
}

/**
 * The Cairo day a stored stamp falls on. A Date (what MySQL returns) or a number (epoch ms) is an
 * instant; text is a UTC stamp, except a bare 'YYYY-MM-DD', which is taken as already being a day
 * (attendance and daily stats store local days that way). Returns null for anything unreadable.
 */
export function cairoDayOfStamp(value: Stamp): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : cairoDay(value);
  if (typeof value === 'number') return Number.isFinite(value) ? cairoDay(new Date(value)) : null;
  const s = String(value ?? '');
  const full = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (full) {
    const [y, m, d] = full[1].split('-').map(Number);
    return cairoDay(new Date(Date.UTC(y, m - 1, d, Number(full[2]), Number(full[3]), Number(full[4] || 0))));
  }
  const bare = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return bare ? bare[1] : null;
}

/** The instant a stamp denotes (text read as UTC, like the legacy backend wrote it), or null. */
export function toInstant(value: Stamp): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null;
  const s = String(value ?? '');
  const full = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z)?$/.exec(s);
  if (full) return new Date(Date.UTC(+full[1], +full[2] - 1, +full[3], +full[4], +full[5], +(full[6] || 0)));
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** 'YYYY-MM-DD HH:MM:SS' in Cairo wall time for an instant. */
export function cairoWallStamp(date: Date = new Date()): string {
  const { year, month, day, hour, minute, second } = cairoParts(date);
  return `${year}-${p(month)}-${p(day)} ${p(hour)}:${p(minute)}:${p(second)}`;
}
