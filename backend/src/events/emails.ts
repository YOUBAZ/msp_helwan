import { esc, layout } from '../mail/templates';
import type { Mail } from '../mail/mail.service';
import { formatCairo } from './timeline';

type Ev = { title: string; startsAt: Date; venue: string };
type Person = { email: string; name: string };

const when = (e: Ev) => `${formatCairo(e.startsAt)} (Cairo time)`;
const details = (e: Ev) => [
  `<b>When:</b> ${esc(when(e))}`,
  `<b>Where:</b> ${esc(e.venue)}`,
];
const first = (name: string) => esc(name.split(' ')[0]);

/** Ticket with the QR code attached (confirmed, or promoted from the waiting list). */
export function ticketEmail(
  p: Person,
  e: Ev,
  link: string,
  qr: Buffer,
  promoted = false,
): Mail {
  const intro = promoted
    ? `Good news, ${first(p.name)}! A seat opened up and it's yours.`
    : `You're registered, ${first(p.name)}! See you there.`;
  return {
    to: p.email,
    subject: `Your ticket: ${e.title}`,
    html: layout({
      heading: e.title,
      paragraphs: [
        intro,
        ...details(e),
        'Show this QR code at the door:',
        '<img src="cid:ticket-qr" alt="Ticket QR code" width="220" height="220" style="display:block;border:8px solid #fff;border-radius:12px">',
      ],
      button: { label: 'Open my ticket', url: link },
      footnote:
        "Can't make it? Open your ticket and cancel, so someone on the waiting list gets your seat.",
    }),
    text: `${intro.replace(/<[^>]+>/g, '')}\n\n${e.title}\nWhen: ${when(e)}\nWhere: ${e.venue}\n\nYour ticket (show it at the door, or cancel): ${link}`,
    attachments: [{ filename: 'ticket-qr.png', content: qr, cid: 'ticket-qr' }],
  };
}

export function waitlistedEmail(
  p: Person,
  e: Ev,
  link: string,
  position: number,
): Mail {
  return {
    to: p.email,
    subject: `You're on the waiting list: ${e.title}`,
    html: layout({
      heading: e.title,
      paragraphs: [
        `Thanks, ${first(p.name)}. The event is full, so you're <b>number ${position}</b> on the waiting list.`,
        "If a seat opens up, you'll get it automatically and we'll email your ticket.",
        ...details(e),
      ],
      button: { label: 'View my place', url: link },
    }),
    text: `The event is full: you're number ${position} on the waiting list for ${e.title}.\nIf a seat opens up you'll get it automatically and we'll email your ticket.\n\n${link}`,
  };
}

export function eventChangedEmail(p: Person, e: Ev, link: string): Mail {
  return {
    to: p.email,
    subject: `Event details changed: ${e.title}`,
    html: layout({
      heading: 'The event details have changed',
      paragraphs: [
        `Hi ${first(p.name)}, please note the updated details for <b>${esc(e.title)}</b>:`,
        ...details(e),
      ],
      button: { label: 'Open my ticket', url: link },
    }),
    text: `Updated details for ${e.title}:\nWhen: ${when(e)}\nWhere: ${e.venue}\n\n${link}`,
  };
}

export function eventCancelledEmail(p: Person, e: Ev): Mail {
  return {
    to: p.email,
    subject: `Event cancelled: ${e.title}`,
    html: layout({
      heading: 'This event has been cancelled',
      paragraphs: [
        `Hi ${first(p.name)}, we're sorry: <b>${esc(e.title)}</b> (${esc(when(e))}) has been cancelled.`,
        'Follow MSP Tech Club for upcoming events.',
      ],
    }),
    text: `Sorry, ${e.title} (${when(e)}) has been cancelled.`,
  };
}

export function registrationCancelledEmail(p: Person, e: Ev): Mail {
  return {
    to: p.email,
    subject: `Registration cancelled: ${e.title}`,
    html: layout({
      heading: 'Your registration was cancelled',
      paragraphs: [
        `Hi ${first(p.name)}, your registration for <b>${esc(e.title)}</b> was cancelled by the organisers.`,
        'If you think this is a mistake, reply to this email.',
      ],
    }),
    text: `Your registration for ${e.title} was cancelled by the organisers. Reply to this email if you think this is a mistake.`,
  };
}

export function reminderEmail(
  p: Person,
  e: Ev,
  link: string,
  qr: Buffer,
): Mail {
  return {
    to: p.email,
    subject: `Tomorrow: ${e.title}`,
    html: layout({
      heading: `See you tomorrow, ${first(p.name)}!`,
      paragraphs: [
        `A reminder that <b>${esc(e.title)}</b> is tomorrow.`,
        ...details(e),
        'Show this QR code at the door:',
        '<img src="cid:ticket-qr" alt="Ticket QR code" width="220" height="220" style="display:block;border:8px solid #fff;border-radius:12px">',
      ],
      button: { label: 'Open my ticket', url: link },
      footnote:
        "Can't make it after all? Please cancel from your ticket so someone else gets your seat.",
    }),
    text: `Reminder: ${e.title} is tomorrow.\nWhen: ${when(e)}\nWhere: ${e.venue}\n\nYour ticket: ${link}`,
    attachments: [{ filename: 'ticket-qr.png', content: qr, cid: 'ticket-qr' }],
  };
}
