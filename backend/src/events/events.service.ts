import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { sniffImage } from '../access/profile';
import { DB, type Database } from '../db/database';
import { eventCovers, eventRegistrations, events } from '../db/schema';
import { UPLOAD_LOCK, usedMediaBytes } from '../media/budget';
import { MediaService } from '../media/media.service';
import type { CreateEventDto, UpdateEventDto } from './dto';
import {
  type AdminEvent,
  type Counts,
  type EventRow,
  NO_COUNTS,
  type PublicEvent,
  toAdmin,
  toPublic,
} from './serialize';

const MAX_COVER = 2 * 1024 * 1024;

@Injectable()
export class EventsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly media: MediaService,
  ) {}

  // ---------- Reading ----------

  /** Registration numbers per event. */
  async counts(ids: string[]): Promise<Map<string, Counts>> {
    const map = new Map<string, Counts>();
    if (!ids.length) return map;
    const rows = await this.db
      .select({
        eventId: eventRegistrations.eventId,
        confirmed: sql<number>`count(*) filter (where ${eventRegistrations.status} = 'confirmed')`,
        waitlisted: sql<number>`count(*) filter (where ${eventRegistrations.status} = 'waitlisted')`,
        checkedIn: sql<number>`count(*) filter (where ${eventRegistrations.status} = 'confirmed' and ${eventRegistrations.checkedInAt} is not null)`,
      })
      .from(eventRegistrations)
      .where(inArray(eventRegistrations.eventId, ids))
      .groupBy(eventRegistrations.eventId);
    for (const r of rows) {
      map.set(r.eventId, {
        confirmed: Number(r.confirmed),
        waitlisted: Number(r.waitlisted),
        checkedIn: Number(r.checkedIn),
      });
    }
    return map;
  }

  /** Published events split by timeline: upcoming soonest first, past newest first. */
  async publicLists(now = new Date()) {
    const rows = await this.db
      .select()
      .from(events)
      .where(eq(events.published, true))
      .orderBy(asc(events.startsAt));
    const counts = await this.counts(rows.map((r) => r.id));
    const all = rows.map((r) =>
      toPublic(r, counts.get(r.id) ?? NO_COUNTS, now),
    );
    return {
      upcoming: all.filter((e) => e.phase === 'upcoming'),
      live: all.filter((e) => e.phase === 'live'),
      past: all.filter((e) => e.phase === 'past').reverse(),
    };
  }

  async row(id: string): Promise<EventRow> {
    const [e] = await this.db.select().from(events).where(eq(events.id, id));
    if (!e) throw new NotFoundException('Event not found.');
    return e;
  }

  async publicEvent(id: string, now = new Date()): Promise<PublicEvent> {
    const e = await this.row(id);
    if (!e.published) throw new NotFoundException('Event not found.');
    return toPublic(e, (await this.counts([id])).get(id) ?? NO_COUNTS, now);
  }

  async adminList(now = new Date()): Promise<AdminEvent[]> {
    const rows = await this.db
      .select()
      .from(events)
      .orderBy(asc(events.startsAt));
    const counts = await this.counts(rows.map((r) => r.id));
    return rows.map((r) => toAdmin(r, counts.get(r.id) ?? NO_COUNTS, now));
  }

  async adminEvent(id: string, now = new Date()): Promise<AdminEvent> {
    const e = await this.row(id);
    return toAdmin(e, (await this.counts([id])).get(id) ?? NO_COUNTS, now);
  }

  async categories(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ c: events.category })
      .from(events)
      .orderBy(asc(events.category));
    return rows.map((r) => r.c);
  }

  // ---------- Writing ----------

  async create(dto: CreateEventDto) {
    const [e] = await this.db
      .insert(events)
      .values({
        title: dto.title,
        category: dto.category,
        startsAt: new Date(dto.startsAt),
        venue: dto.venue ?? 'To be announced',
      })
      .returning();
    return toAdmin(e, NO_COUNTS, new Date());
  }

  /** Apply edits (business rules about registrants are enforced by callers). */
  async applyUpdate(id: string, dto: UpdateEventDto) {
    const e = await this.row(id);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : e.startsAt;
    const endsAt =
      dto.endsAt === undefined
        ? e.endsAt
        : dto.endsAt
          ? new Date(dto.endsAt)
          : null;
    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException(
        'The end time must be after the start time.',
      );
    }
    const deadline =
      dto.registrationDeadline === undefined
        ? e.registrationDeadline
        : dto.registrationDeadline
          ? new Date(dto.registrationDeadline)
          : null;
    if (deadline && deadline > startsAt) {
      throw new BadRequestException(
        'The registration deadline must be before the event starts.',
      );
    }
    const [updated] = await this.db
      .update(events)
      .set({
        title: dto.title,
        category: dto.category,
        description: dto.description,
        venue: dto.venue,
        startsAt,
        endsAt,
        capacity: dto.capacity,
        registrationOpen: dto.registrationOpen,
        registrationDeadline: deadline,
        published: dto.published,
        mediaAlbumId: dto.mediaAlbumId,
        highlight:
          dto.highlight === undefined ? undefined : dto.highlight || null,
        partners: dto.partners?.map((p) => p.trim()).filter(Boolean),
        manualAttendance: dto.manualAttendance,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id))
      .returning();
    return { before: e, after: updated };
  }

  // ---------- Cover photo ----------

  async setCover(id: string, file?: { buffer: Buffer; size: number }) {
    await this.row(id);
    if (!file?.buffer?.length)
      throw new BadRequestException('Please choose an image.');
    if (file.size > MAX_COVER) {
      throw new PayloadTooLargeException(
        'The cover must be smaller than 2 MB.',
      );
    }
    const mime = sniffImage(file.buffer);
    if (!mime)
      throw new BadRequestException('Please upload a JPG, PNG or WebP image.');
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${UPLOAD_LOCK})`);
      const [old] = await tx
        .select({ bytes: eventCovers.bytes })
        .from(eventCovers)
        .where(eq(eventCovers.eventId, id));
      const used = (await usedMediaBytes(tx)) - (old?.bytes ?? 0);
      if (used + file.size > this.media.budget()) {
        throw new PayloadTooLargeException(
          'Media storage is full: remove photos or move to a bigger storage plan.',
        );
      }
      await tx
        .insert(eventCovers)
        .values({ eventId: id, mime, data: file.buffer, bytes: file.size })
        .onConflictDoUpdate({
          target: eventCovers.eventId,
          set: { mime, data: file.buffer, bytes: file.size },
        });
      await tx
        .update(events)
        .set({
          coverVersion: sql`${events.coverVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(events.id, id));
    });
    return this.adminEvent(id);
  }

  async removeCover(id: string) {
    await this.row(id);
    await this.db.transaction(async (tx) => {
      await tx.delete(eventCovers).where(eq(eventCovers.eventId, id));
      await tx.update(events).set({ coverVersion: 0 }).where(eq(events.id, id));
    });
  }

  async cover(id: string) {
    const [c] = await this.db
      .select()
      .from(eventCovers)
      .where(eq(eventCovers.eventId, id));
    if (!c) throw new NotFoundException();
    return c;
  }
}
