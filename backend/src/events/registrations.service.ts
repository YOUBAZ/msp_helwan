import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, count, eq, inArray, lt, ne } from 'drizzle-orm';
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
import { newTicketCode, qrDataUrl, qrPng, ticketUrl } from './tickets';
import { phase } from './timeline';

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
      if (current.status === 'confirmed' && !event.cancelledAt) {
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
    if (timeChanged) {
      await this.db
        .update(eventRegistrations)
        .set({ reminderSentAt: null })
        .where(eq(eventRegistrations.eventId, id));
    }
    if (dto.notifyChanges && (timeChanged || before.venue !== after.venue)) {
      for (const r of active) {
        await this.mail.send(
          eventChangedEmail(r, after, this.link(r.ticketCode)),
        );
      }
    }

    if (dto.capacity !== undefined && !after.cancelledAt) {
      let promoted: Registration[] = [];
      await this.db.transaction(async (tx) => {
        promoted = await this.promoteWaitlist(tx, await this.lockEvent(tx, id));
      });
      for (const p of promoted) await this.sendTicket(p, after, true);
    }
  }

  async cancelEvent(id: string) {
    const e = await this.events.row(id);
    if (e.cancelledAt) return;
    await this.db
      .update(events)
      .set({
        cancelledAt: new Date(),
        registrationOpen: false,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id));
    for (const r of await this.active(id))
      await this.mail.send(eventCancelledEmail(r, e));
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
}
