/**
 * The values the original product writes into its open-vocabulary columns (read from its source). They are plain
 * text in the database because the original treats them as text and could add values without a schema change;
 * the services validate against these lists, and the importer's pre-flight report lists any legacy value that is
 * not here so nothing is silently rewritten.
 */
export const BOOKING_STATUSES = ['scheduled', 'examined', 'no_show', 'cancelled'] as const;
export const CALL_RESULT_KINDS = ['lead', 'manual', 'reminder'] as const;

/** Lead outcomes a rep may record, plus the four reminder-call outcomes. */
export const LEAD_OUTCOMES = ['no_answer', 'unreachable', 'very_interested', 'interested', 'follow_up', 'not_interested', 'booked'] as const;
export const REMINDER_OUTCOMES = ['reminder_confirmed', 'reminder_no_answer', 'reminder_cancelled', 'reminder_rescheduled'] as const;

export const CALL_DIRECTIONS = ['outbound', 'inbound', 'missed'] as const;
export const BOOKING_EVENT_KINDS = ['booked', 'rescheduled', 'reminder_message', 'attendance_cleared', 'cancelled', 'case_renamed'] as const;
export const HANDOVER_REASONS = ['claimed', 'returned', 'redistributed', 'day_done', 'idle_day', 'two_calls', 'promise_back', 'no_show'] as const;
export const CLAIM_RESULTS = ['claimed', 'empty', 'blocked_window', 'blocked_hold', 'blocked_nolink', 'no_work'] as const;
