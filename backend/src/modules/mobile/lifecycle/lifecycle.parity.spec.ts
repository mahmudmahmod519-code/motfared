/**
 * Differential check against the legacy implementation: the TypeScript port and the original
 * lead-to-doctor/backend/src/lifecycle.js must give identical answers for every combination of the
 * inputs that decide the cadence. Skipped when the sibling legacy project is not present.
 */
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import * as ts from './lifecycle';

const legacyDir = resolve(__dirname, '../../../../../../lead-to-doctor/backend/src');
const available = existsSync(join(legacyDir, 'lifecycle.js'));
const maybe = available ? describe : describe.skip;

maybe('lifecycle: TypeScript port vs legacy lifecycle.js', () => {
  let legacy: any;
  beforeAll(() => {
    process.env.DB_PATH = join(tmpdir(), `ltd-parity-${process.pid}-${Date.now()}.sqlite`);
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-long-enough-to-pass-the-32-char-check';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    legacy = require(join(legacyDir, 'lifecycle.js'));
  });

  const statuses = ['new', 'no_answer', 'interested', 'very_interested', 'not_interested', 'booked', 'examined', 'follow_up', 'unreachable', 'weird'];
  const nows = [new Date(Date.UTC(2026, 7, 23)), new Date('2026-08-30T21:30:00Z'), new Date('2026-01-18T22:30:00Z')];

  it('nextAction agrees on every combination', () => {
    let n = 0;
    for (const status of statuses)
      for (const attemptsToday of [0, 1, 2, 3, 5])
        for (const attemptDays of [0, 1, 2, 3])
          for (const whatsappSentAt of [null, '2026-08-22 10:00:00'])
            for (const createdAt of [null, '2026-08-20'])
              for (const now of nows) {
                const input = { createdAt, status, whatsappSentAt, attemptsToday, attemptDays, now };
                expect(ts.nextAction(input)).toEqual(legacy.nextAction(input));
                n++;
              }
    expect(n).toBe(10 * 5 * 4 * 2 * 2 * 3); // every combination was compared
  });

  it('closeReason agrees on every combination', () => {
    for (const status of statuses)
      for (const attemptsTotal of [0, 1, 3, 4, 7])
        for (const attemptDays of [0, 1, 2, 3])
          for (const whatsappSentAt of [null, '2026-08-22 10:00:00']) {
            const input = { status, attemptsTotal, attemptDays, whatsappSentAt };
            expect(ts.closeReason(input)).toEqual(legacy.closeReason(input));
          }
  });

  it('dayIndexOf, isWeeklyOff and previousWorkingDay agree across DST and month ends', () => {
    const stamps = ['2026-08-20 09:00:00', '2026-08-30 20:00:00', '2026-08-30 21:30:00', '2026-01-18 12:00:00', '2026-04-23 21:30:00', '2026-12-31 22:30:00'];
    const instants = [
      '2026-08-21T09:00:00Z', '2026-08-23T09:00:00Z', '2026-08-30T21:30:00Z', '2026-08-31T09:00:00Z', '2026-01-18T22:30:00Z',
      '2026-04-26T10:00:00Z', '2027-01-02T10:00:00Z',
    ].map((s) => new Date(s));
    for (const s of stamps) for (const now of instants) expect(ts.dayIndexOf(s, now)).toBe(legacy.dayIndexOf(s, now));
    for (const day of ['2026-08-20', '2026-08-21', '2026-08-22', '2026-01-01', 'garbage']) {
      expect(ts.isWeeklyOff(day)).toBe(legacy.isWeeklyOff(day));
      expect(ts.previousWorkingDay(day)).toBe(legacy.previousWorkingDay(day));
    }
  });
});
