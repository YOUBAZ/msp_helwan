import {
  cairoDate,
  phase,
  registrationCloses,
  startsTomorrowInCairo,
} from './timeline';

const at = (iso: string) => new Date(iso);
const H = 3600 * 1000;

describe('phase', () => {
  const start = at('2026-12-01T10:00:00Z');
  it('is upcoming before the start', () => {
    expect(
      phase({ startsAt: start, endsAt: null }, at('2026-12-01T09:59:00Z')),
    ).toBe('upcoming');
  });
  it('is live from the start until the end time', () => {
    const e = { startsAt: start, endsAt: at('2026-12-01T12:00:00Z') };
    expect(phase(e, start)).toBe('live');
    expect(phase(e, at('2026-12-01T11:59:00Z'))).toBe('live');
    expect(phase(e, at('2026-12-01T12:00:00Z'))).toBe('past');
  });
  it('is live for 3 hours when there is no end time', () => {
    const e = { startsAt: start, endsAt: null };
    expect(phase(e, new Date(start.getTime() + 3 * H - 1))).toBe('live');
    expect(phase(e, new Date(start.getTime() + 3 * H))).toBe('past');
  });
});

describe('registrationCloses', () => {
  const startsAt = at('2026-12-01T10:00:00Z');
  it('closes at the deadline when one is set', () => {
    const deadline = at('2026-11-29T20:00:00Z');
    expect(
      registrationCloses({
        startsAt,
        endsAt: null,
        registrationDeadline: deadline,
      }),
    ).toEqual(deadline);
  });
  it('closes at the start when there is no deadline', () => {
    expect(
      registrationCloses({
        startsAt,
        endsAt: null,
        registrationDeadline: null,
      }),
    ).toEqual(startsAt);
  });
});

describe('cairoDate', () => {
  it('uses Cairo time in winter (UTC+2)', () => {
    expect(cairoDate(at('2026-03-01T22:30:00Z'))).toBe('2026-03-02');
    expect(cairoDate(at('2026-03-01T21:30:00Z'))).toBe('2026-03-01');
  });
  it('uses Cairo summer time (UTC+3)', () => {
    expect(cairoDate(at('2026-07-01T21:30:00Z'))).toBe('2026-07-02');
  });
});

describe('startsTomorrowInCairo', () => {
  const now = at('2026-03-02T07:00:00Z'); // 09:00 Cairo on 2 March
  it('tomorrowInCairo handles UTC/Cairo day boundary', () => {
    // 00:30 Cairo on 4 March is 22:30 UTC on 3 March: that's two Cairo days away.
    expect(startsTomorrowInCairo(at('2026-03-03T22:30:00Z'), now)).toBe(false);
    // 00:30 Cairo on 3 March is 22:30 UTC on 2 March: tomorrow in Cairo.
    expect(startsTomorrowInCairo(at('2026-03-02T22:30:00Z'), now)).toBe(true);
  });
  it('is false for an event later today', () => {
    expect(startsTomorrowInCairo(at('2026-03-02T18:00:00Z'), now)).toBe(false);
  });
  it('is true for an event in the evening tomorrow', () => {
    expect(startsTomorrowInCairo(at('2026-03-03T19:00:00Z'), now)).toBe(true);
  });
});
