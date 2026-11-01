import * as lifecycle from './lifecycle';

/**
 * Ported from the legacy backend's test/lifecycle.test.js: the same cases and expectations, with the
 * database-backed ones rewritten over plain arrays (the pure functions take the call history as data).
 * `now` is pinned so nothing depends on the day the suite runs: 23 Aug 2026 00:00 UTC = 03:00 Cairo.
 */
const NOW = new Date(Date.UTC(2026, 7, 23));

// createdAt only has to exist (a claimed lead); the clock is attemptDays: the number of distinct days
// somebody rang this lead, today included once it was rung today.
const at = (createdAt: string | null, status: string, attemptsToday: number, whatsappSentAt: string | null = null, attemptDays = attemptsToday > 0 ? 1 : 0) =>
  lifecycle.nextAction({ createdAt, status, attemptsToday, whatsappSentAt, attemptDays, now: NOW });

describe('nextAction (the follow-up cadence)', () => {
  it('day one: two calls, then wait for tomorrow', () => {
    expect(at('2026-08-23', 'new', 0)!.action).toBe('call');
    expect(at('2026-08-23', 'new', 0)!.callsLeftToday).toBe(2);
    expect(at('2026-08-23', 'no_answer', 1)!.action).toBe('call');
    expect(at('2026-08-23', 'no_answer', 1)!.callsLeftToday).toBe(1);
    const spent = at('2026-08-23', 'no_answer', 2)!;
    expect(spent.action).toBe('wait_tomorrow'); // quota spent, but there is still tomorrow
    expect(spent.callsLeftToday).toBe(0);
  });

  it('day two: two more calls, then WhatsApp', () => {
    expect(at('2026-08-22', 'no_answer', 0, null, 1)!.action).toBe('call');
    expect(at('2026-08-22', 'no_answer', 0, null, 1)!.dayIndex).toBe(1);
    expect(at('2026-08-22', 'no_answer', 1, null, 2)!.action).toBe('call');
    expect(at('2026-08-22', 'no_answer', 2, null, 2)!.action).toBe('whatsapp'); // the window has no third day
  });

  it('past the window goes straight to WhatsApp, then closes once it is sent', () => {
    expect(at('2026-08-20', 'no_answer', 0, null, 2)!.action).toBe('whatsapp');
    expect(at('2026-08-20', 'no_answer', 0, '2026-08-23 10:00', 2)!.action).toBe('close');
  });

  it('a day nobody rang is not a day of the chase spent', () => {
    expect(at('2026-08-20', 'no_answer', 0, null, 0)!.action).toBe('call');
    expect(at('2026-08-20', 'no_answer', 0, null, 0)!.dayIndex).toBe(0);
    expect(lifecycle.closeReason({ status: 'no_answer', attemptsTotal: 4, attemptDays: 2, whatsappSentAt: '2026-08-22 20:00' })).toBeNull();
    expect(lifecycle.closeReason({ status: 'no_answer', attemptsTotal: 4, attemptDays: 1, whatsappSentAt: '2026-08-22 20:00' })).toMatch(/يوم واحد/);
  });

  it('a WhatsApp sent early is recorded but does not stand in for the remaining calls', () => {
    expect(at('2026-08-23', 'no_answer', 0, '2026-08-23 10:00')!.action).toBe('call');
    expect(at('2026-08-23', 'no_answer', 2, '2026-08-23 10:00')!.action).toBe('wait_tomorrow');
    expect(at('2026-08-21', 'no_answer', 0, '2026-08-23 10:00', 2)!.action).toBe('close');
  });

  it('only unanswered leads are governed by the cadence', () => {
    for (const status of ['interested', 'very_interested', 'not_interested', 'booked', 'examined', 'follow_up', 'unreachable']) {
      expect(at('2026-08-20', status, 0)).toBeNull();
    }
    for (const status of ['new', 'no_answer']) expect(at('2026-08-20', status, 0)).not.toBeNull();
  });

  it('dayIndex is the number of earlier days with calls, whatever the calendar says', () => {
    expect(at('2026-08-23', 'new', 0, null, 0)!.dayIndex).toBe(0);
    expect(at('2026-08-23', 'new', 1, null, 1)!.dayIndex).toBe(0); // today's own calls do not make today an earlier day
    expect(at('2026-08-22', 'new', 0, null, 1)!.dayIndex).toBe(1);
    expect(at('2026-08-20', 'new', 1, null, 2)!.dayIndex).toBe(1);
    expect(at('2026-08-20', 'new', 0, null, 2)!.dayIndex).toBe(2);
  });

  it('a lead nobody has claimed has no action', () => {
    expect(at(null, 'new', 0)).toBeNull();
  });

  it('carries the Arabic labels the app shows', () => {
    expect(at('2026-08-23', 'new', 0)!.label).toBe('اتصل');
    expect(at('2026-08-23', 'new', 2)!.label).toBe('خلّصت مكالمات النهاردة — كمّل بكرة');
    expect(at('2026-08-20', 'no_answer', 0, null, 2)!.label).toBe('مردّش — ابعتله واتساب');
    expect(at('2026-08-20', 'no_answer', 0, '2026-08-23 10:00', 2)!.label).toBe('اقفل الليد');
  });
});

describe('the business calendar', () => {
  it('day counting reads the Cairo calendar, not UTC and not the process timezone', () => {
    const claimedLateEvening = '2026-08-30 20:00:00'; // 23:00 Cairo, still the 30th
    expect(lifecycle.dayIndexOf(claimedLateEvening, new Date('2026-08-30T20:30:00Z'))).toBe(0); // same Cairo evening
    expect(lifecycle.dayIndexOf(claimedLateEvening, new Date('2026-08-30T21:30:00Z'))).toBe(1); // past Cairo midnight
    expect(lifecycle.dayIndexOf(claimedLateEvening, new Date('2026-08-31T00:30:00Z'))).toBe(1); // still day 1 at 03:30 Cairo
    expect(lifecycle.dayIndexOf('2026-08-30 21:30:00', new Date('2026-08-31T09:00:00Z'))).toBe(0); // 00:30 Cairo belongs to the 31st
    expect(lifecycle.dayIndexOf('2026-01-18 12:00:00', new Date('2026-01-18T22:30:00Z'))).toBe(1); // winter (+2)
  });

  it('works with the Date objects MySQL returns, not only legacy text stamps', () => {
    expect(lifecycle.dayIndexOf(new Date('2026-08-30T20:00:00Z'), new Date('2026-08-30T21:30:00Z'))).toBe(1);
  });

  it('the day count skips the days the business is shut, so a weekend cannot spend the chase window', () => {
    // 2026-08-21 is a Friday, the default day off.
    expect(lifecycle.dayIndexOf('2026-08-20 09:00:00', new Date('2026-08-21T09:00:00Z'))).toBe(0); // the Friday itself is not a day
    expect(lifecycle.dayIndexOf('2026-08-20 09:00:00', new Date('2026-08-22T09:00:00Z'))).toBe(1); // Saturday is day one
    expect(lifecycle.dayIndexOf('2026-08-20 09:00:00', new Date('2026-08-23T09:00:00Z'))).toBe(2);

    // The chase itself no longer reads this calendar: two calls on Thursday and two on Friday are two days.
    const chased = lifecycle.nextAction({
      createdAt: '2026-08-20 09:00:00',
      status: 'no_answer',
      whatsappSentAt: null,
      attemptsToday: 2,
      attemptDays: 2,
      now: new Date('2026-08-21T18:00:00Z'),
    });
    expect(chased!.action).toBe('whatsapp');

    expect(lifecycle.previousWorkingDay('2026-08-22')).toBe('2026-08-20'); // Saturday's "yesterday" is Thursday
    expect(lifecycle.previousWorkingDay('2026-08-20')).toBe('2026-08-19');
  });

  it('the weekly days off are a per-company setting with a safe default', () => {
    expect(lifecycle.DEFAULT_WEEKLY_OFF).toEqual([5]);
    expect(lifecycle.parseWeeklyOffDays(null)).toEqual([5]);
    expect(lifecycle.parseWeeklyOffDays(undefined)).toEqual([5]);
    expect(lifecycle.parseWeeklyOffDays('[4,5]')).toEqual([4, 5]);
    expect(lifecycle.parseWeeklyOffDays('[]')).toEqual([]);
    expect(lifecycle.parseWeeklyOffDays('not json')).toEqual([5]);
    expect(lifecycle.parseWeeklyOffDays('{"a":1}')).toEqual([5]);
    expect(lifecycle.parseWeeklyOffDays('[5, 9, -1, "x", 2.5, 0]')).toEqual([5, 0]); // only integers 0..6 survive
  });

  it('a different weekly off changes the day count, and a business closed every day cannot loop forever', () => {
    // Saturday (6) off instead of Friday: Thursday -> Saturday has only the Friday as a working day.
    const sat = lifecycle.dayIndexOf('2026-08-20 09:00:00', new Date('2026-08-22T09:00:00Z'), [6]);
    expect(sat).toBe(1);
    expect(lifecycle.isWeeklyOff('2026-08-21', [5])).toBe(true);
    expect(lifecycle.isWeeklyOff('2026-08-21', [6])).toBe(false);
    expect(lifecycle.isWeeklyOff('garbage', [5])).toBe(false);
    expect(lifecycle.previousWorkingDay('2026-08-22', [0, 1, 2, 3, 4, 5, 6])).toBe('2026-08-14'); // bounded walk
  });
});

describe('attempts are derived from call history, never a stored counter', () => {
  const claimed = new Date('2026-08-23T06:00:00Z');

  it("today's attempts are counted on the Cairo day, so a 00:30 call is not yesterday's", () => {
    // Two calls at 23:00 Cairo on 1 Sep (20:00 UTC), one at 00:30 Cairo on 2 Sep (21:30 UTC).
    const a = lifecycle.summarizeAttempts(
      { results: [{ at: '2026-09-01 20:00:00' }, { at: '2026-09-01 20:10:00' }, { at: '2026-09-01 21:30:00' }], dials: [] },
      new Date('2026-09-01T22:00:00Z'),
    );
    expect(a.today).toBe(1); // only the post-midnight call is today's: the quota is fresh
    expect(a.total).toBe(3);
    expect(a.days).toBe(2);
  });

  it('counts ordinary calls only: reminder calls and manual outcomes are excluded', () => {
    const today = '2026-08-23';
    const a = lifecycle.summarizeAttempts(
      {
        results: [
          { at: `${today} 09:00:00`, kind: 'lead' },
          { at: `${today} 11:00:00`, kind: 'lead' },
          { at: '2026-08-20 09:00:00', kind: 'lead' }, // an older day
          { at: `${today} 12:00:00`, kind: 'reminder' }, // about a booking, not chasing a lead
          { at: `${today} 13:00:00`, kind: 'manual' }, // an outcome set without a call
        ],
        dials: [],
      },
      NOW,
    );
    expect(a.today).toBe(2);
    expect(a.total).toBe(3);
  });

  it('everything is floored at first_claimed_at and counts every rep who held the lead', () => {
    const results = [
      { at: new Date('2026-08-22T09:00:00Z'), kind: 'lead', user_id: 'old-owner-before-claim' }, // before the chase began
      { at: new Date('2026-08-23T06:30:00Z'), kind: 'lead', user_id: 'rep-a' },
      { at: new Date('2026-08-23T07:30:00Z'), kind: 'lead', user_id: 'rep-a' },
    ];
    const a = lifecycle.summarizeAttempts({ results, dials: [], firstClaimedAt: claimed }, NOW);
    expect(a.total).toBe(2);
    expect(a.today).toBe(2);
    expect(a.days).toBe(1);
  });

  it("the phone's own dials can raise the count but never lower it", () => {
    const results = [{ at: '2026-08-23 06:30:00' }];
    const dials = [new Date('2026-08-23T06:29:00Z'), new Date('2026-08-23T06:31:00Z'), new Date('2026-08-23T07:00:00Z')];
    const raised = lifecycle.summarizeAttempts({ results, dials }, NOW);
    expect(raised.today).toBe(3); // one answer written up, three real rings
    expect(raised.total).toBe(3);
    const unsynced = lifecycle.summarizeAttempts({ results: [{ at: '2026-08-23 06:30:00' }, { at: '2026-08-23 06:40:00' }], dials: [] }, NOW);
    expect(unsynced.total).toBe(2); // a phone that has not synced falls back to the recorded count
    const fewerDials = lifecycle.summarizeAttempts({ results: [{ at: '2026-08-23 06:30:00' }, { at: '2026-08-23 06:40:00' }], dials }, NOW);
    expect(fewerDials.today).toBe(3); // max of the two sources per day, not their sum
  });

  it('days are the union of the days with an outcome or a dial', () => {
    const a = lifecycle.summarizeAttempts(
      { results: [{ at: '2026-08-21 09:00:00' }], dials: [new Date('2026-08-22T09:00:00Z')] },
      NOW,
    );
    expect(a.days).toBe(2);
    expect(a.total).toBe(2);
    expect(a.today).toBe(0);
  });

  it('a lead with no history has zero attempts', () => {
    expect(lifecycle.summarizeAttempts({ results: [], dials: [] }, NOW)).toEqual({ today: 0, total: 0, days: 0 });
  });
});

describe('decorate', () => {
  const noHistory = new Map();

  it('attaches the next action to each lead row', () => {
    const rows = [
      { id: 900, status: 'no_answer', claimed_at: '2026-08-23 08:00:00', whatsapp_sent_at: null },
      { id: 901, status: 'interested', claimed_at: '2026-08-23 08:00:00', whatsapp_sent_at: null },
    ];
    const [chased, opinionated] = lifecycle.decorateLeads(rows, noHistory, NOW);
    expect(chased.nextAction!.action).toBe('call');
    expect(opinionated.nextAction).toBeNull();
    expect(typeof chased.attemptsToday).toBe('number');
  });

  it('the follow-up clock starts at claimed_at, not created_at', () => {
    const justClaimed = { id: 902, status: 'new', created_at: '2026-08-13', claimed_at: '2026-08-23', whatsapp_sent_at: null };
    expect(lifecycle.decorateLeads([justClaimed], noHistory, NOW)[0].nextAction!.action).toBe('call');
  });

  it('a lead still sitting unclaimed gets no next action at all', () => {
    const unclaimed = { id: 903, status: 'new', created_at: '2026-08-23', claimed_at: null, whatsapp_sent_at: null };
    expect(lifecycle.decorateLeads([unclaimed], noHistory, NOW)[0].nextAction).toBeNull();
  });

  it("a lead handed over carries the previous rep's calls: the chase is the client's, not the rep's", () => {
    const firstClaimedAt = new Date('2026-08-23T06:00:00Z');
    const history = new Map([
      [
        904,
        {
          firstClaimedAt,
          results: [
            { at: new Date('2026-08-23T06:30:00Z'), kind: 'lead', user_id: 'rep-a' },
            { at: new Date('2026-08-23T07:30:00Z'), kind: 'lead', user_id: 'rep-a' },
          ],
          dials: [],
        },
      ],
    ]);
    const base = { id: 904, status: 'no_answer', claimed_at: '2026-08-23 06:00:00', whatsapp_sent_at: null };
    const before = lifecycle.decorateLeads([base], history, NOW)[0];
    expect(before.attemptsToday).toBe(2);
    expect(before.nextAction!.action).toBe('wait_tomorrow');

    // Handed to rep B at 09:00: only claimed_at changes; the count is the lead's.
    const received = lifecycle.decorateLeads([{ ...base, claimed_at: '2026-08-23 09:00:00' }], history, NOW)[0];
    expect(received.attemptsToday).toBe(2);
    expect(received.nextAction!.action).toBe('wait_tomorrow');
    expect(received.attemptsTotal).toBe(2);
    expect(received.attemptDays).toBe(1);

    // The next day the receiver rings twice more: four calls on two days, closable once messaged.
    history.get(904)!.results.push(
      { at: new Date('2026-08-24T08:00:00Z'), kind: 'lead', user_id: 'rep-b' },
      { at: new Date('2026-08-24T09:00:00Z'), kind: 'lead', user_id: 'rep-b' },
    );
    const done = lifecycle.decorateLeads([{ ...base, claimed_at: '2026-08-23 09:00:00' }], history, new Date(Date.UTC(2026, 7, 24, 8)))[0];
    expect(done.attemptsTotal).toBe(4);
    expect(done.attemptDays).toBe(2);
    expect(done.nextAction!.action).toBe('whatsapp');
    expect(done.closeReason).toMatch(/واتساب/);
  });

  it('callCount takes the larger of recorded outcomes and real dials; outcomeCount stays the recorded one', () => {
    const history = new Map([[905, { results: [{ at: '2026-08-23 08:00:00', kind: 'lead' }], dials: [new Date('2026-08-23T07:00:00Z'), new Date('2026-08-23T08:00:00Z')] }]]);
    const [d] = lifecycle.decorateLeads([{ id: 905, status: 'no_answer', claimed_at: '2026-08-23 06:00:00', whatsapp_sent_at: null, callCount: 1 }], history, NOW);
    expect(d.callCount).toBe(2);
    expect(d.outcomeCount).toBe(1);
    const [plain] = lifecycle.decorateLeads([{ id: 906, status: 'new', claimed_at: '2026-08-23 06:00:00', whatsapp_sent_at: null }], noHistory, NOW);
    expect('callCount' in plain).toBe(false); // only decorated when the row carries one
  });
});

describe('closeReason', () => {
  const ok = { status: 'no_answer', attemptsTotal: 4, attemptDays: 2, whatsappSentAt: '2026-08-22 20:00' };
  it('allows closing only after four attempts on two days and a WhatsApp', () => {
    expect(lifecycle.closeReason(ok)).toBeNull();
    expect(lifecycle.closeReason({ ...ok, status: 'new' })).toBeNull();
  });
  it('explains each refusal in the words the app shows', () => {
    expect(lifecycle.closeReason({ ...ok, status: 'unreachable' })).toBe('الليد ده متقفل خلاص');
    expect(lifecycle.closeReason({ ...ok, status: 'interested' })).toBe('الليد ده رد عليك - مش تعذّر وصول');
    expect(lifecycle.closeReason({ ...ok, attemptsTotal: 3 })).toBe('لسه 3 من 4 مكالمات - كمّل المحاولات الأول');
    expect(lifecycle.closeReason({ ...ok, attemptDays: 1 })).toBe('المكالمات كلها في يوم واحد - يتقفل بعد مكالمات تاني يوم');
    expect(lifecycle.closeReason({ ...ok, whatsappSentAt: null })).toBe('ابعتله واتساب الأول وبعدين اقفله');
  });
});
