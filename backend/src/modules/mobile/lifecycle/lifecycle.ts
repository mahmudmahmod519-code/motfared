import { Stamp, addDays, cairoDay, cairoDayOfStamp, toInstant } from '../../../common/clock/cairo-clock';

/**
 * Lead follow-up lifecycle, ported from the legacy backend's lifecycle.js and kept as pure functions
 * of plain values (no database), so the rules can be exercised directly.
 *
 * A lead is worked for two days and then closed:
 *   day 1  - call twice
 *   day 2  - call twice more, if the first day got no answer
 *   after  - send the WhatsApp follow-up, then close the lead as unreachable
 *
 * The chase belongs to the LEAD, not to whoever holds it, and its "days" are the days somebody
 * actually rang, not calendar days or working days. A chased lead goes back into the pool at the end
 * of a day for whoever pulls it next, so the next rep must see the calls already made: every count is
 * floored at first_claimed_at and counts every rep's calls, and a "day" is a Cairo day with at least
 * one attempt on it. Nothing is stored as a counter: attempts are derived from the call history,
 * which is correct on every read and works retroactively.
 *
 * The one thing that cannot be derived is the WhatsApp message (it is sent from WhatsApp itself), so
 * the rep marking it is stored on the lead (`whatsapp_sent_at`).
 */

export const FOLLOW_UP_WINDOW_DAYS = 2;
export const CALLS_PER_DAY = 2;

/** Statuses governed by the cadence; a lead that expressed an opinion is on a different track. */
export const LIFECYCLE_STATUSES = ['new', 'no_answer'];
export const UNREACHABLE = 'unreachable';

export const NEXT_ACTION_LABELS = {
  call: 'اتصل',
  wait_tomorrow: 'خلّصت مكالمات النهاردة — كمّل بكرة',
  whatsapp: 'مردّش — ابعتله واتساب',
  close: 'اقفل الليد',
} as const;

export type NextActionName = keyof typeof NEXT_ACTION_LABELS;

export interface NextAction {
  action: NextActionName;
  label: string;
  dayIndex: number;
  callsLeftToday: number;
}

// ───────────────────────────── weekly days off ─────────────────────────────

export const WEEKLY_OFF_KEY = 'weekly_off_days';
export const DEFAULT_WEEKLY_OFF = [5]; // Friday

/** Reads the stored `weekly_off_days` setting (JSON array of 0..6); anything unusable falls back to the default. */
export function parseWeeklyOffDays(value: string | null | undefined): number[] {
  if (value == null) return DEFAULT_WEEKLY_OFF;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : DEFAULT_WEEKLY_OFF;
  } catch {
    return DEFAULT_WEEKLY_OFF;
  }
}

function toDayNumber(value: string | null): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  const [, year, month, day] = match;
  return Math.floor(Date.UTC(+year, +month - 1, +day) / 86400000);
}

/** Whether a 'YYYY-MM-DD' day is one of the weekly days off. */
export function isWeeklyOff(dateStr: string, offDays: number[] = DEFAULT_WEEKLY_OFF): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return false;
  return offDays.includes(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay());
}

/** The last day the business was open before `dayStr`, skipping the weekly days off. */
export function previousWorkingDay(dayStr: string, offDays: number[] = DEFAULT_WEEKLY_OFF): string {
  let day = addDays(dayStr, -1);
  // Bounded: a business closed every day of the week would otherwise loop forever.
  for (let i = 0; i < 7 && isWeeklyOff(day, offDays); i += 1) day = addDays(day, -1);
  return day;
}

/**
 * How many *working* days have passed since a stamp, counting its own day as nought. Not the chase
 * clock (that is attemptDays); kept for surfaces that reason about the business calendar itself.
 */
export function dayIndexOf(createdAt: Stamp, now: Date = new Date(), offDays: number[] = DEFAULT_WEEKLY_OFF): number {
  const createdDay = cairoDayOfStamp(createdAt);
  const todayDay = cairoDay(now);
  const created = toDayNumber(createdDay);
  const today = toDayNumber(todayDay);
  if (created == null || today == null || today <= created) return 0;

  let index = 0;
  let day = createdDay as string;
  for (let i = 0; i < today - created; i += 1) {
    day = addDays(day, 1);
    if (!isWeeklyOff(day, offDays)) index += 1;
  }
  return index;
}

// ───────────────────────────── the decision ─────────────────────────────

export interface NextActionInput {
  createdAt: Stamp;
  status: string;
  whatsappSentAt?: Stamp;
  attemptsToday: number;
  attemptDays?: number;
  now?: Date;
}

/**
 * What should the rep do with this lead right now. `createdAt` is only asked whether it exists: a
 * lead nobody has pulled yet (claimed_at null) has nothing to be told. The clock is `attemptDays`,
 * the distinct days this lead has been rung on by anyone, so a day nobody called is not a day of the
 * chase spent. `dayIndex` is the number of those days before today.
 */
export function nextAction({ createdAt, status, whatsappSentAt, attemptsToday, attemptDays = 0 }: NextActionInput): NextAction | null {
  if (!LIFECYCLE_STATUSES.includes(status)) return null;
  if (!createdAt) return null;

  const daysWithCalls = Math.max(0, attemptDays || 0);
  // Today is one of the counted days only once something was dialled on it.
  const dayIndex = attemptsToday > 0 ? Math.max(0, daysWithCalls - 1) : daysWithCalls;
  const callsLeftToday = Math.max(0, CALLS_PER_DAY - (attemptsToday || 0));
  // Two full days of calls are behind the lead: either two earlier days, or one earlier day plus
  // today's quota spent.
  const windowElapsed = dayIndex >= FOLLOW_UP_WINDOW_DAYS || (dayIndex === FOLLOW_UP_WINDOW_DAYS - 1 && callsLeftToday === 0);

  // The WhatsApp message is the last step of the chase, so it closes the lead, but only once the
  // calling window has actually elapsed: a message sent on day one is recorded and does not stand in
  // for the remaining calls.
  if (whatsappSentAt && windowElapsed) {
    return { action: 'close', label: NEXT_ACTION_LABELS.close, dayIndex, callsLeftToday: 0 };
  }
  if (windowElapsed) {
    return { action: 'whatsapp', label: NEXT_ACTION_LABELS.whatsapp, dayIndex, callsLeftToday: 0 };
  }
  if (callsLeftToday > 0) {
    return { action: 'call', label: NEXT_ACTION_LABELS.call, dayIndex, callsLeftToday };
  }
  // Today's quota is spent and the window has not elapsed, so there is a tomorrow.
  return { action: 'wait_tomorrow', label: NEXT_ACTION_LABELS.wait_tomorrow, dayIndex, callsLeftToday: 0 };
}

/** Closing as "تعذّر الوصول" needs this many attempts behind it, on at least this many days. */
export const CLOSE_MIN_ATTEMPTS = 4;
export const CLOSE_MIN_DAYS = 2;

/**
 * Why a lead may not be closed as "تعذّر الوصول" yet, or null when it may: four attempts on two
 * different days, the message sent, and the client never having answered. One function so the
 * server's refusal and the reason the app shows are the same words, decided the same way.
 */
export function closeReason(input: { status: string; attemptsTotal?: number; attemptDays?: number; whatsappSentAt?: Stamp }): string | null {
  const { status, attemptsTotal, attemptDays, whatsappSentAt } = input;
  if (status === UNREACHABLE) return 'الليد ده متقفل خلاص';
  if (!LIFECYCLE_STATUSES.includes(status)) return 'الليد ده رد عليك - مش تعذّر وصول';
  const attempts = attemptsTotal || 0;
  if (attempts < CLOSE_MIN_ATTEMPTS) return `لسه ${attempts} من ${CLOSE_MIN_ATTEMPTS} مكالمات - كمّل المحاولات الأول`;
  if ((attemptDays || 0) < CLOSE_MIN_DAYS) return 'المكالمات كلها في يوم واحد - يتقفل بعد مكالمات تاني يوم';
  if (!whatsappSentAt) return 'ابعتله واتساب الأول وبعدين اقفله';
  return null;
}

// ───────────────────────────── attempts, derived from history ─────────────────────────────

export interface AttemptHistory {
  /** Recorded outcomes (call_results). `kind` defaults to 'lead'; only 'lead' rows count. */
  results: { at: Stamp; kind?: string | null; user_id?: string }[];
  /** The phone's own outbound dials, as timestamps (call log). Only ever raises the count. */
  dials: Stamp[];
  /** Start of the chase: earlier history is ignored. Null/undefined = no floor. */
  firstClaimedAt?: Stamp;
}

export interface AttemptSummary {
  today: number;
  total: number;
  days: number;
}

/**
 * Attempts on one lead: today's, over the whole chase, and the number of distinct Cairo days with at
 * least one. A recorded outcome is one *answer*, not one ring, so the attempts are whichever of the
 * recorded outcomes and the phone's real dials is higher on each day (never their sum, since a
 * written-up call is both one outcome and one dial). Only `kind = 'lead'` rows count: a reminder call
 * is about an existing booking, and a 'manual' row is an outcome set without a call.
 */
export function summarizeAttempts(history: AttemptHistory, now: Date = new Date()): AttemptSummary {
  const todayDay = cairoDay(now);
  const floor = history.firstClaimedAt ? toInstant(history.firstClaimedAt) : null;
  const afterFloor = (at: Date | null) => !!at && (!floor || at.getTime() >= floor.getTime());

  const outcomeDays = new Map<string, number>();
  const dialDays = new Map<string, number>();
  const bump = (map: Map<string, number>, at: Date) => {
    const day = cairoDay(at);
    map.set(day, (map.get(day) || 0) + 1);
  };
  for (const r of history.results) {
    const at = toInstant(r.at);
    if ((r.kind ?? 'lead') === 'lead' && afterFloor(at)) bump(outcomeDays, at!);
  }
  for (const d of history.dials) {
    const at = toInstant(d);
    if (afterFloor(at)) bump(dialDays, at!);
  }

  const days = new Set([...outcomeDays.keys(), ...dialDays.keys()]);
  let total = 0;
  for (const day of days) total += Math.max(outcomeDays.get(day) || 0, dialDays.get(day) || 0);
  return { today: Math.max(outcomeDays.get(todayDay) || 0, dialDays.get(todayDay) || 0), total, days: days.size };
}

// ───────────────────────────── decoration ─────────────────────────────

export interface LeadLike {
  id: string | number;
  status: string;
  claimed_at?: Stamp;
  whatsapp_sent_at?: Stamp;
  callCount?: number | string;
  [key: string]: any;
}

/**
 * Decorates lead rows with their attempts, next action and close reason. `historyById` carries each
 * lead's call history (loaded in one batched query by the caller); a lead without an entry has none.
 */
export function decorateLeads<T extends LeadLike>(leads: T[], historyById: Map<T['id'], AttemptHistory>, now: Date = new Date()) {
  return leads.map((lead) => {
    const a = summarizeAttempts(historyById.get(lead.id) ?? { results: [], dials: [] }, now);
    return {
      ...lead,
      // "اتصلنا به كام مرة" on the card comes from recorded outcomes alone, while the cadence line next
      // to it counts the phone's real dials as well; the card shows the larger of the two and the
      // un-boosted half travels as outcomeCount so a screen can say which number it is showing.
      ...(lead.callCount !== undefined
        ? { callCount: Math.max(Number(lead.callCount) || 0, a.total), outcomeCount: Number(lead.callCount) || 0 }
        : {}),
      attemptsToday: a.today,
      attemptsTotal: a.total,
      attemptDays: a.days,
      nextAction: nextAction({
        createdAt: lead.claimed_at,
        status: lead.status,
        whatsappSentAt: lead.whatsapp_sent_at,
        attemptsToday: a.today,
        attemptDays: a.days,
        now,
      }),
      // Null means "may be closed now"; otherwise the words the app shows in place of the button.
      closeReason: closeReason({
        status: lead.status,
        attemptsTotal: a.total,
        attemptDays: a.days,
        whatsappSentAt: lead.whatsapp_sent_at,
      }),
    };
  });
}
