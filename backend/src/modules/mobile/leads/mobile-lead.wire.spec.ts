import { orderForCalling, stamp, toWirePhoneCall } from './mobile-lead.wire';

describe('mobile lead wire helpers', () => {
  it('stamp renders legacy UTC text, independent of the process timezone', () => {
    expect(stamp(new Date('2026-08-23T06:00:00Z'))).toBe('2026-08-23 06:00:00');
    expect(stamp(null)).toBeNull();
  });

  it("orders yesterday's silent numbers first and keeps the rest newest-first", () => {
    const mk = (id: number, status: string, attemptsToday: number, action: string | null) => ({ id, status, attemptsToday, nextAction: action ? { action } : null });
    const ordered = orderForCalling([mk(1, 'new', 0, 'call'), mk(2, 'no_answer', 0, 'call'), mk(3, 'no_answer', 2, 'wait_tomorrow'), mk(4, 'no_answer', 0, 'call')]);
    expect(ordered.map((l) => l.id)).toEqual([2, 4, 1, 3]);
  });

  it('maps a phone call to the timeline shape the app reads', () => {
    expect(toWirePhoneCall({ direction: 'missed', durationSeconds: 0, occurredAt: 1790000000000, repName: null, leadId: 7 })).toMatchObject({
      direction: 'missed', directionLabel: 'فايتة', durationSeconds: 0, occurredAt: 1790000000000, matched: true,
    });
    expect(toWirePhoneCall({ direction: 'weird', durationSeconds: 5, occurredAt: 1 }).matched).toBe(false);
  });
});
