import { pickSeasons } from './pick-seasons';

describe('pickSeasons', () => {
  it('uses the only published season, with no previous one', () => {
    expect(pickSeasons([{ number: 26, status: 'archived' }])).toEqual({
      current: 26,
      previous: null,
    });
  });
  it('picks the current season and the one before it, ignoring drafts', () => {
    expect(
      pickSeasons([
        { number: 28, status: 'draft' },
        { number: 26, status: 'archived' },
        { number: 27, status: 'current' },
      ]),
    ).toEqual({ current: 27, previous: 26 });
  });
  it('falls back to the newest published season when none is current', () => {
    expect(
      pickSeasons([
        { number: 24, status: 'archived' },
        { number: 25, status: 'archived' },
      ]),
    ).toEqual({ current: 25, previous: 24 });
  });
  it('handles no seasons', () => {
    expect(pickSeasons([])).toEqual({ current: null, previous: null });
  });
});
