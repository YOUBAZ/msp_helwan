/** Date logic for events, all relative to Cairo time. */

export type EventTimes = { startsAt: Date; endsAt: Date | null };

const HOUR = 3600 * 1000;
/** How long an event counts as "happening now" when it has no end time. */
const DEFAULT_DURATION = 3 * HOUR;

export function phase(e: EventTimes, now: Date): 'upcoming' | 'live' | 'past' {
  if (now < e.startsAt) return 'upcoming';
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + DEFAULT_DURATION);
  return now < end ? 'live' : 'past';
}

/** Registration closes at the deadline, or when the event starts. */
export function registrationCloses(
  e: EventTimes & { registrationDeadline: Date | null },
): Date {
  return e.registrationDeadline ?? e.startsAt;
}

const cairo = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date (YYYY-MM-DD) of an instant, in Cairo. */
export function cairoDate(d: Date): string {
  return cairo.format(d);
}

/** True when `startsAt` falls on the Cairo calendar day after `now`'s. */
export function startsTomorrowInCairo(startsAt: Date, now: Date): boolean {
  const today = cairoDate(now);
  const [y, m, d] = today.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1))
    .toISOString()
    .slice(0, 10);
  return cairoDate(startsAt) === tomorrow;
}

const cairoLong = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

/** "Monday 3 March 2026 at 10:00 am" in Cairo time, for emails. */
export function formatCairo(d: Date): string {
  return cairoLong.format(d).replace(', ', ' ').replace(' at ', ' at ');
}

const cairoShort = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "2026-03-01 10:00" in Cairo time, for spreadsheets. */
export function cairoDateTime(d: Date): string {
  return cairoShort.format(d).replace(',', '');
}
