import * as clock from './cairo-clock';

/**
 * Ported from the legacy backend's test/clock.test.js (same dates, same expectations), plus the
 * Date-based variants the MySQL-backed code uses. Egypt is UTC+2 in winter and UTC+3 in summer
 * (DST returned in 2023, last Friday of April to last Thursday of October); every date sits on one
 * side or the other of that switch, so a fixed-offset implementation would fail here.
 */
describe('Cairo business clock', () => {
  it('cairoDay and cairoHour read Cairo wall time, not the process timezone', () => {
    const summerNight = new Date('2026-09-01T21:30:00Z'); // 00:30 Cairo on 2 Sep (+3)
    expect(clock.cairoDay(summerNight)).toBe('2026-09-02');
    expect(clock.cairoHour(summerNight)).toBe(0);

    const winterNight = new Date('2026-01-15T22:30:00Z'); // 00:30 Cairo on 16 Jan (+2)
    expect(clock.cairoDay(winterNight)).toBe('2026-01-16');
    expect(clock.cairoHour(winterNight)).toBe(0);

    expect(clock.cairoDay(new Date('2026-01-15T21:30:00Z'))).toBe('2026-01-15');
    expect(clock.cairoHour(new Date('2026-01-15T21:30:00Z'))).toBe(23);
  });

  it('the offset follows daylight saving rather than being a fixed +3', () => {
    const HOUR = 3600 * 1000;
    expect(clock.cairoOffsetMs(new Date('2026-04-23T12:00:00Z'))).toBe(2 * HOUR); // day before DST starts
    expect(clock.cairoOffsetMs(new Date('2026-04-25T12:00:00Z'))).toBe(3 * HOUR); // day after
    expect(clock.cairoOffsetMs(new Date('2026-10-29T12:00:00Z'))).toBe(3 * HOUR); // still summer
    expect(clock.cairoOffsetMs(new Date('2026-10-31T12:00:00Z'))).toBe(2 * HOUR); // winter again
  });

  it('cairoDateTime finds the UTC instant of a Cairo wall time on either side of the switch', () => {
    expect(clock.cairoDateTime('2026-04-23', '10:00').toISOString()).toBe('2026-04-23T08:00:00.000Z');
    expect(clock.cairoDateTime('2026-04-25', '10:00').toISOString()).toBe('2026-04-25T07:00:00.000Z');
    expect(clock.cairoDateTime('2026-10-29', '10:00').toISOString()).toBe('2026-10-29T07:00:00.000Z');
    expect(clock.cairoDateTime('2026-10-31', '10:00').toISOString()).toBe('2026-10-31T08:00:00.000Z');
    expect(clock.cairoDateTime('2026-09-02', '00:30').toISOString()).toBe('2026-09-01T21:30:00.000Z');
  });

  it('cairoDayBounds gives the half-open UTC range as legacy SQL stamps', () => {
    expect(clock.cairoDayBounds('2026-09-02')).toEqual({ startUtc: '2026-09-01 21:00:00', endUtc: '2026-09-02 21:00:00' });
    expect(clock.cairoDayBounds('2026-01-16')).toEqual({ startUtc: '2026-01-15 22:00:00', endUtc: '2026-01-16 22:00:00' });
    const switchDay = clock.cairoDayBounds('2026-04-24'); // a day that spans the DST switch is 23 hours long
    expect(switchDay.startUtc).toBe('2026-04-23 22:00:00');
    expect(switchDay.endUtc).toBe('2026-04-24 21:00:00');
  });

  it('cairoDayRange gives the same bounds as Dates, for MySQL queries', () => {
    const r = clock.cairoDayRange('2026-04-24');
    expect(r.start.toISOString()).toBe('2026-04-23T22:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-04-24T21:00:00.000Z');
  });

  it('cairoMonthBounds covers the whole Cairo month including the year boundary', () => {
    expect(clock.cairoMonthBounds('2026-12')).toEqual({ startUtc: '2026-11-30 22:00:00', endUtc: '2026-12-31 22:00:00' });
  });

  it('a stamp written at 00:30 Cairo belongs to the new day, not the UTC one', () => {
    expect(clock.cairoDayOfStamp('2026-09-01 21:30:00')).toBe('2026-09-02');
    expect(clock.cairoDayOfStamp('2026-09-01T21:30:00')).toBe('2026-09-02');
    expect(clock.cairoDayOfStamp('2026-09-01')).toBe('2026-09-01'); // a bare day is already local
    expect(clock.cairoDayOfStamp(null)).toBeNull();
  });

  it('cairoDayOfStamp also accepts the Date objects MySQL returns', () => {
    expect(clock.cairoDayOfStamp(new Date('2026-09-01T21:30:00Z'))).toBe('2026-09-02');
    expect(clock.cairoDayOfStamp(new Date('2026-09-01T20:59:59Z'))).toBe('2026-09-01');
    expect(clock.cairoDayOfStamp(new Date('invalid'))).toBeNull();
  });

  it('addDays walks the calendar across month and year ends', () => {
    expect(clock.addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(clock.addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(clock.addDays('2026-09-02', -7)).toBe('2026-08-26');
  });

  it('cairoWallStamp renders the local wall time for comparing user-entered stamps', () => {
    expect(clock.cairoWallStamp(new Date('2026-09-01T21:30:05Z'))).toBe('2026-09-02 00:30:05');
  });
});
