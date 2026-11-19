import type { events } from '../db/schema';
import { phase, registrationCloses } from './timeline';

export type EventRow = typeof events.$inferSelect;
export type Counts = {
  confirmed: number;
  waitlisted: number;
  checkedIn: number;
};

export type PublicEvent = {
  id: string;
  title: string;
  category: string;
  description: string;
  venue: string;
  startsAt: Date;
  endsAt: Date | null;
  coverUrl: string | null;
  partners: string[];
  highlight: string | null;
  mediaAlbumId: string | null;
  phase: 'upcoming' | 'live' | 'past';
  cancelled: boolean;
  capacity: number | null;
  confirmed: number;
  waitlisted: number;
  attendance: number | null;
  registration: 'open' | 'waitlist' | 'closed';
};

export type AdminEvent = PublicEvent & {
  published: boolean;
  registrationOpen: boolean;
  registrationDeadline: Date | null;
  manualAttendance: number | null;
  checkedIn: number;
};

export const NO_COUNTS: Counts = { confirmed: 0, waitlisted: 0, checkedIn: 0 };

export function registrationState(
  e: EventRow,
  c: Counts,
  now: Date,
): PublicEvent['registration'] {
  if (!e.published || e.cancelledAt || !e.registrationOpen) return 'closed';
  if (now >= registrationCloses(e)) return 'closed';
  if (e.capacity !== null && c.confirmed >= e.capacity) return 'waitlist';
  return 'open';
}

export function toPublic(e: EventRow, c: Counts, now: Date): PublicEvent {
  return {
    id: e.id,
    title: e.title,
    category: e.category,
    description: e.description,
    venue: e.venue,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    coverUrl:
      e.coverVersion > 0 ? `/events/${e.id}/cover?v=${e.coverVersion}` : null,
    partners: e.partners,
    highlight: e.highlight,
    mediaAlbumId: e.mediaAlbumId,
    phase: phase(e, now),
    cancelled: !!e.cancelledAt,
    capacity: e.capacity,
    confirmed: c.confirmed,
    waitlisted: c.waitlisted,
    attendance: c.checkedIn > 0 ? c.checkedIn : e.manualAttendance,
    registration: registrationState(e, c, now),
  };
}

export function toAdmin(e: EventRow, c: Counts, now: Date): AdminEvent {
  return {
    ...toPublic(e, c, now),
    published: e.published,
    registrationOpen: e.registrationOpen,
    registrationDeadline: e.registrationDeadline,
    manualAttendance: e.manualAttendance,
    checkedIn: c.checkedIn,
  };
}
