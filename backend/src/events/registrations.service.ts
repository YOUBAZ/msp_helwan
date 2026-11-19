import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, count, eq, gt, inArray, isNull, lt, ne } from 'drizzle-orm';
import { uniqueViolation } from '../access/roles.service';
import { frontendUrl } from '../common/frontend-url';
import { DB, type Database } from '../db/database';
import type { Tx } from '../db/reorder';
import { eventRegistrations, events } from '../db/schema';
import { MailService } from '../mail/mail.service';
import type { UpdateEventDto } from './dto';
import {
  eventCancelledEmail,
  eventChangedEmail,
  registrationCancelledEmail,
  reminderEmail,
  ticketEmail,
  waitlistedEmail,
} from './emails';
import { EventsService } from './events.service';
import {
  type EventRow,
  NO_COUNTS,
  registrationState,
  toPublic,
} from './serialize';
import {
  codeFrom,
  newTicketCode,
  qrDataUrl,
  qrPng,
  ticketUrl,
} from './tickets';
import { eachLimited } from '../common/each-limited';
import {
  cairoDate,
  cairoDateTime,
  phase,
  startsTomorrowInCairo,
} from './timeline';

export type Registration = typeof eventRegistrations.$inferSelect;
export type RegisterInput = {
  name: string;
  email: string;
  phone: string;
  faculty: string;
  year: string;
};

const DUPLICATE =
  "You're already registered for this event. We've re-sent your ticket email.";

/** Emails sent at once in bulk sends (matches the SMTP pool size). */
const MAIL_CONCURRENCY = 3;

@Injectable()
export class RegistrationsService {
  private readonly site: string;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly events: EventsService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.site = frontendUrl(config);
  }

  link(code: string) {
    return ticketUrl(this.site, code);
  }

  // ---------- Helpers ----------

  /** Lock the event row for the rest of the transaction (seat changes are serialised). */
  private async lockEvent(tx: Tx, eventId: string): Promise<EventRow> {
    const [e] = await tx
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .for('update');
    if (!e) throw new NotFoundException('Event not found.');
    return e;
  }

  private async confirmedCount(tx: Tx | Database, eventId: string) {
    const [r] = await tx
      .select({ n: count() })
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.status, 'confirmed'),
        ),
      );
    return Number(r.n);
  }

  /** 1-based place on the waiting list. */
  private async position(r: Registration) {
    if (r.status !== 'waitlisted') return null;
    const [x] = await this.db
      .select({ n: count() })
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, r.eventId),
          eq(eventRegistrations.status, 'waitlisted'),
          lt(eventRegistrations.createdAt, r.createdAt),
        ),
      );
    return Number(x.n) + 1;
  }

  /**
   * Fill free seats from the waiting list, oldest first. Must run inside a
   * transaction that has locked the event. Returns the people promoted.
   */
  async promoteWaitlist(tx: Tx, e: EventRow): Promise<Registration[]> {
    const confirmed = await this.confirmedCount(tx, e.id);
    const free =
      e.capacity === null ? Number.MAX_SAFE_INTEGER : e.capacity - confirmed;
    if (free <= 0) return [];
    const next = await tx
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, e.id),
          eq(eventRegistrations.status, 'waitlisted'),
        ),
      )
      .orderBy(asc(eventRegistrations.createdAt))
      .limit(Math.min(free, 1000));
    if (!next.length) return [];
    return tx
      .update(eventRegistrations)
      .set({ status: 'confirmed', confirmedAt: new Date() })
      .where(
        inArray(
          eventRegistrations.id,
          next.map((r) => r.id),
        ),
      )
      .returning();
  }

  /** Email tickets (or waiting-list notices); never throws. */
  async sendTicket(r: Registration, e: EventRow, promoted = false) {
    const link = this.link(r.ticketCode);
    if (r.status === 'confirmed') {
      await this.mail.send(
        ticketEmail(r, e, link, await qrPng(link), promoted),
      );
    } else if (r.status === 'waitlisted') {
      await this.mail.send(
        waitlistedEmail(r, e, link, (await this.position(r)) ?? 1),
      );
    }
  }

  // ---------- Public ----------

  async register(eventId: string, input: RegisterInput) {
    const email = input.email.trim().toLowerCase();
    const now = new Date();
    let existing: Registration | undefined;
    let created: Registration | undefined;
    let event!: EventRow;
    try {
      await this.db.transaction(async (tx) => {
        event = await this.lockEvent(tx, eventId);
        if (!event.published) throw new NotFoundException('Event not found.');
        [existing] = await tx
          .select()
          .from(eventRegistrations)
          .where(
            and(
              eq(eventRegistrations.eventId, eventId),
              eq(eventRegistrations.email, email),
              ne(eventRegistrations.status, 'cancelled'),
            ),
          );
        if (existing) return;
        const confirmed = await this.confirmedCount(tx, eventId);
        const state = registrationState(
          event,
          { ...NO_COUNTS, confirmed },
          now,
        );
        if (state === 'closed') {
          throw new BadRequestException(
            'Registration for this event is closed.',
          );
        }
        const status = state === 'open' ? 'confirmed' : 'waitlisted';
        [created] = await tx
          .insert(eventRegistrations)
          .values({
            eventId,
            name: input.name,
            email,
            phone: input.phone,
            faculty: input.faculty,
            year: input.year,
            status,
            ticketCode: newTicketCode(),
            confirmedAt: status === 'confirmed' ? now : null,
          })
          .returning();
      });
    } catch (err) {
      throw uniqueViolation(err, DUPLICATE);
    }
    if (existing) {
      await this.sendTicket(existing, event);
      throw new ConflictException(DUPLICATE);
    }
    await this.sendTicket(created!, event);
    return { ticketCode: created!.ticketCode, status: created!.status };
  }

  private async byCode(code: string) {
    const [r] = await this.db
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.ticketCode, code));
    if (!r) throw new NotFoundException('Ticket not found.');
    return r;
  }

  async ticket(code: string) {
    const r = await this.byCode(code);
    const e = await this.events.row(r.eventId);
    const counts = (await this.events.counts([e.id])).get(e.id) ?? NO_COUNTS;
    return {
      status: r.status,
      position: await this.position(r),
      name: r.name,
      qr:
        r.status === 'confirmed'
          ? await qrDataUrl(this.link(r.ticketCode))
          : null,
      checkedInAt: r.checkedInAt,
      event: toPublic(e, counts, new Date()),
    };
  }

  /** Cancel a registration and give freed seats to the waiting list. */
  private async cancelRegistration(r: Registration, mustBeUpcoming: boolean) {
    let promoted: Registration[] = [];
    let event!: EventRow;
    await this.db.transaction(async (tx) => {
      event = await this.lockEvent(tx, r.eventId);
      if (mustBeUpcoming && phase(event, new Date()) !== 'upcoming') {
        throw new BadRequestException(
          "This event has already started, so the registration can't be cancelled.",
        );
      }
      const [current] = await tx
        .select()
        .from(eventRegistrations)
        .where(eq(eventRegistrations.id, r.id));
      if (current.status === 'cancelled') return;
      await tx
        .update(eventRegistrations)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(eventRegistrations.id, r.id));
      // Freed seats go to the waiting list only while the event is still
      // ahead: nobody wants "a seat opened up" for an event that's over.
      if (
        current.status === 'confirmed' &&
        !event.cancelledAt &&
        phase(event, new Date()) === 'upcoming'
      ) {
        promoted = await this.promoteWaitlist(tx, event);
      }
    });
    for (const p of promoted) await this.sendTicket(p, event, true);
    return event;
  }

  async cancelByTicket(code: string) {
    const r = await this.byCode(code);
    await this.cancelRegistration(r, true);
    return { status: 'cancelled' as const };
  }

  /** Board cancels someone: they're told, the next person moves in. */
  async cancelByBoard(registrationId: string) {
    const [r] = await this.db
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.id, registrationId));
    if (!r) throw new NotFoundException('Registration not found.');
    if (r.status === 'cancelled') return;
    const event = await this.cancelRegistration(r, false);
    await this.mail.send(registrationCancelledEmail(r, event));
  }

  // ---------- Event changes that affect registrants ----------

  private async active(eventId: string) {
    return this.db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          ne(eventRegistrations.status, 'cancelled'),
        ),
      );
  }

  async updateEvent(id: string, dto: UpdateEventDto) {
    const e = await this.events.row(id);
    const active = await this.active(id);
    const confirmed = active.filter((r) => r.status === 'confirmed').length;
    if (
      dto.capacity !== undefined &&
      dto.capacity !== null &&
      dto.capacity < confirmed
    ) {
      throw new BadRequestException(
        `Capacity can't be lower than the ${confirmed} people already confirmed.`,
      );
    }
    if (dto.published === false && e.published && active.length > 0) {
      throw new BadRequestException(
        'People are registered: cancel the event instead of unpublishing it.',
      );
    }
    const { before, after } = await this.events.applyUpdate(id, dto);

    const timeChanged =
      before.startsAt.getTime() !== after.startsAt.getTime() ||
      (before.endsAt?.getTime() ?? null) !== (after.endsAt?.getTime() ?? null);
    // A new day needs a new reminder; a new end time (or hour) does not.
    if (cairoDate(before.startsAt) !== cairoDate(after.startsAt)) {
      await this.db
        .update(eventRegistrations)
        .set({ reminderSentAt: null })
        .where(eq(eventRegistrations.eventId, id));
    }
    if (dto.notifyChanges && (timeChanged || before.venue !== after.venue)) {
      await eachLimited(active, MAIL_CONCURRENCY, async (r) => {
        await this.mail.send(
          eventChangedEmail(r, after, this.link(r.ticketCode)),
        );
      });
    }

    if (
      dto.capacity !== undefined &&
      !after.cancelledAt &&
      phase(after, new Date()) === 'upcoming'
    ) {
      let promoted: Registration[] = [];
      await this.db.transaction(async (tx) => {
        promoted = await this.promoteWaitlist(tx, await this.lockEvent(tx, id));
      });
      for (const p of promoted) await this.sendTicket(p, after, true);
    }
  }

  /**
   * Cancel the event and tell everyone registered. Each person is marked once
   * told, so pressing "Cancel event" again (or the daily run) finishes any
   * emails that failed or ran out of time, without repeating anyone.
   */
  async cancelEvent(id: string) {
    const e = await this.events.row(id);
    if (!e.cancelledAt) {
      await this.db
        .update(events)
        .set({
          cancelledAt: new Date(),
          registrationOpen: false,
          updatedAt: new Date(),
        })
        .where(eq(events.id, id));
    }
    await this.sendCancelNotices(e);
  }

  private async sendCancelNotices(e: EventRow, deadline = Infinity) {
    const pending = await this.db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, e.id),
          ne(eventRegistrations.status, 'cancelled'),
          isNull(eventRegistrations.cancelNoticeSentAt),
        ),
      );
    let sent = 0;
    let failed = 0;
    let remaining = 0;
    await eachLimited(pending, MAIL_CONCURRENCY, async (r) => {
      if (Date.now() > deadline) {
        remaining++;
        return;
      }
      if (!(await this.mail.send(eventCancelledEmail(r, e)))) {
        failed++;
        return;
      }
      await this.db
        .update(eventRegistrations)
        .set({ cancelNoticeSentAt: new Date() })
        .where(eq(eventRegistrations.id, r.id));
      sent++;
    });
    return { sent, failed, remaining };
  }

  async deleteEvent(id: string) {
    await this.events.row(id);
    const [r] = await this.db
      .select({ n: count() })
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, id));
    if (Number(r.n) > 0) {
      throw new ConflictException(
        'People are registered: cancel the event instead.',
      );
    }
    await this.db.delete(events).where(eq(events.id, id));
  }

  // ---------- Board: registrations, CSV, check-in ----------

  /** Ticket links can cancel a registration, so only managers get them. */
  async boardList(eventId: string, canManage: boolean) {
    const event = await this.events.adminEvent(eventId);
    const rows = await this.db
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, eventId))
      .orderBy(asc(eventRegistrations.createdAt));
    let waiting = 0;
    return {
      event,
      registrations: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        faculty: r.faculty,
        year: r.year,
        status: r.status,
        position: r.status === 'waitlisted' ? ++waiting : null,
        ticketUrl: canManage ? this.link(r.ticketCode) : undefined,
        createdAt: r.createdAt,
        checkedInAt: r.checkedInAt,
      })),
    };
  }

  /** CSV for Excel: UTF-8 with BOM so Arabic names display correctly. */
  async csv(eventId: string) {
    const e = await this.events.row(eventId);
    const rows = await this.db
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, eventId))
      .orderBy(asc(eventRegistrations.createdAt));
    const cell = (v: string) =>
      /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const lines = [
      'Name,Email,Phone,Faculty,Year,Status,Registered at,Checked in at',
      ...rows.map((r) =>
        [
          r.name,
          r.email,
          r.phone,
          r.faculty,
          r.year,
          r.checkedInAt ? 'checked in' : r.status,
          cairoDateTime(r.createdAt),
          r.checkedInAt ? cairoDateTime(r.checkedInAt) : '',
        ]
          .map(cell)
          .join(','),
      ),
    ];
    const slug =
      e.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'event';
    return {
      filename: `${slug}-registrations.csv`,
      body: '\uFEFF' + lines.join('\r\n') + '\r\n',
    };
  }

  /** Board moves someone in from the waiting list (even past capacity). */
  async promote(registrationId: string) {
    const [r] = await this.db
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.id, registrationId));
    if (!r) throw new NotFoundException('Registration not found.');
    if (r.status !== 'waitlisted') {
      throw new BadRequestException(
        'Only people on the waiting list can be moved in.',
      );
    }
    const event = await this.events.row(r.eventId);
    if (event.cancelledAt || phase(event, new Date()) === 'past') {
      throw new BadRequestException(
        'This event is cancelled or over, so nobody can be moved in.',
      );
    }
    const [updated] = await this.db
      .update(eventRegistrations)
      .set({ status: 'confirmed', confirmedAt: new Date() })
      .where(eq(eventRegistrations.id, r.id))
      .returning();
    await this.sendTicket(updated, event, true);
  }

  private async checkinCounts(eventId: string) {
    const c = (await this.events.counts([eventId])).get(eventId) ?? NO_COUNTS;
    return { checkedIn: c.checkedIn, confirmed: c.confirmed };
  }

  private async checkinRow(eventId: string, r: Registration | undefined) {
    const brief = (x: Registration) => ({
      id: x.id,
      name: x.name,
      status: x.status,
      checkedInAt: x.checkedInAt,
    });
    if (!r)
      return {
        result: 'invalid' as const,
        ...(await this.checkinCounts(eventId)),
      };
    if (r.eventId !== eventId) {
      return {
        result: 'wrong_event' as const,
        registration: brief(r),
        ...(await this.checkinCounts(eventId)),
      };
    }
    if (r.status !== 'confirmed') {
      return {
        result: r.status,
        registration: brief(r),
        ...(await this.checkinCounts(eventId)),
      };
    }
    // Only the first scan wins, even if two volunteers scan at once.
    const [done] = await this.db
      .update(eventRegistrations)
      .set({ checkedInAt: new Date() })
      .where(
        and(
          eq(eventRegistrations.id, r.id),
          isNull(eventRegistrations.checkedInAt),
        ),
      )
      .returning();
    if (!done) {
      const [now] = await this.db
        .select()
        .from(eventRegistrations)
        .where(eq(eventRegistrations.id, r.id));
      return {
        result: 'already' as const,
        registration: brief(now),
        ...(await this.checkinCounts(eventId)),
      };
    }
    return {
      result: 'checked_in' as const,
      registration: brief(done),
      ...(await this.checkinCounts(eventId)),
    };
  }

  async checkinByCode(eventId: string, input: string) {
    await this.events.row(eventId);
    const [r] = await this.db
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.ticketCode, codeFrom(input)));
    return this.checkinRow(eventId, r);
  }

  async checkinById(registrationId: string) {
    const [r] = await this.db
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.id, registrationId));
    if (!r) throw new NotFoundException('Registration not found.');
    return this.checkinRow(r.eventId, r);
  }

  // ---------- Reminders (daily cron) ----------

  /**
   * Email confirmed people about events starting tomorrow (Cairo), once each.
   * Stops before `budgetMs` so the serverless function never times out; the
   * second daily run picks up anything left.
   */
  async sendReminders(now = new Date(), budgetMs = 40_000) {
    const startedAt = Date.now();
    const soon = await this.db
      .select()
      .from(events)
      .where(
        and(
          eq(events.published, true),
          isNull(events.cancelledAt),
          gt(events.startsAt, now),
          lt(events.startsAt, new Date(now.getTime() + 3 * 24 * 3600 * 1000)),
        ),
      );
    const due = soon.filter((e) => startsTomorrowInCairo(e.startsAt, now));
    const deadline = startedAt + budgetMs;
    let sent = 0;
    let failed = 0;
    let remaining = 0;
    for (const e of due) {
      const people = await this.db
        .select()
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, e.id),
            eq(eventRegistrations.status, 'confirmed'),
            isNull(eventRegistrations.reminderSentAt),
          ),
        )
        .orderBy(asc(eventRegistrations.createdAt));
      await eachLimited(people, MAIL_CONCURRENCY, async (r) => {
        if (Date.now() > deadline) {
          remaining++;
          return;
        }
        const link = this.link(r.ticketCode);
        const ok = await this.mail.send(
          reminderEmail(r, e, link, await qrPng(link)),
        );
        if (!ok) {
          failed++;
          return;
        }
        await this.db
          .update(eventRegistrations)
          .set({ reminderSentAt: new Date() })
          .where(eq(eventRegistrations.id, r.id));
        sent++;
      });
    }

    // Finish cancellation emails that didn't all go out when the board
    // cancelled (failed sends or a request that ran out of time).
    const cancelled = await this.db
      .select()
      .from(events)
      .where(
        and(
          gt(events.startsAt, new Date(now.getTime() - 24 * 3600 * 1000)),
          inArray(
            events.id,
            this.db
              .select({ id: eventRegistrations.eventId })
              .from(eventRegistrations)
              .where(
                and(
                  ne(eventRegistrations.status, 'cancelled'),
                  isNull(eventRegistrations.cancelNoticeSentAt),
                ),
              ),
          ),
        ),
      );
    for (const e of cancelled.filter((x) => x.cancelledAt)) {
      const r = await this.sendCancelNotices(e, deadline);
      sent += r.sent;
      failed += r.failed;
      remaining += r.remaining;
    }
    return { sent, failed, remaining };
  }
}
