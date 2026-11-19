# Events: management, registration and check-in — design

Date: 2026-11-19 · Status: awaiting approval (reviewed by a builder; open questions answered)

## Intent

The Events page (`/events`) and the home page's event card are hard-coded and already out of date ("Board Recruitment 2026 · Live Now", "See Details" buttons that do nothing). The club wants a simple event system it can actually run MSP events with: the board publishes events, students register on the website, the board sees who's coming and checks people in at the door, and the site moves events from upcoming to past by itself. Requirements PDF: E1 (past events with date, venue, attendees, partners, summary), E4 (season calendar, home page countdown, event registration).

## Decided with the team

- **Manage events from the dashboard:** create, edit, delete — controlled by a permission the President grants.
- **Students register on the website.**
- **The board sees who's registered and checks them in.**
- **Automatic timeline:** events move from Upcoming to Past by their date.
- **Upcoming events on the home page.**
- **All 10 suggestions are in:** (1) ticket email with a QR code, scanned at the door (search by name/email always works too); (2) capacity limit; (3) waiting list; (4) registration deadline; (5) attendees download as a spreadsheet (CSV); (6) attendance numbers shown on past events; (7) link a past event to its Media album; (8) home page countdown to the next event; (9) self-cancel link in the ticket email; (10) reminder email the day before.
- **Registration needs no account:** a short public form (name, email, phone, faculty, year), one registration per email per event.
- **An event has** a title, date and time, venue, description, cover photo, category (Workshop, Hackathon, Session…) and partners; **a board member can open or close registration.**
- **Waiting list promotion is automatic:** when a confirmed person cancels a full event, the first person on the waiting list gets the seat and their ticket email. The board can also move someone in by hand.

## Goals

1. Board members with the permission manage events without a developer; nothing on the Events or home page is hard-coded anymore.
2. Anyone can register in under a minute, without an account, and gets a ticket they can show at the door.
3. At the door, a volunteer checks people in by scanning their QR code with a phone, or by searching a name.
4. Past events show real proof of impact (attendance), and link to their photos.
5. Works on phones (registration, ticket, check-in all happen on phones).

## Non-goals (this round)

- Payments or paid tickets.
- Student accounts or a "my events" history across events.
- Certificates generation (the CSV export enables doing it elsewhere).
- Multi-session / multi-day agendas inside one event.
- Recruitment / applications (separate, postponed feature).

## Anti-goals

- A registration form that a casual bot can fill (protection level chosen: light — see Spam protection).
- Anyone except authorised board members seeing registrants' phone numbers and emails.
- A person checked in twice, or a cancelled/waitlisted ticket accepted at the door without the volunteer noticing.
- Seats lost: a cancellation on a full event that doesn't move the next person in.
- Duplicate or wrongly-timed reminder emails.
- Times shown in the wrong time zone.

## Constraints

- Same stack and patterns as the rest of the project: NestJS + Drizzle (migrations as SQL strings in `backend/src/db/migrations.ts`), permissions in `backend/src/access/permissions.ts` with `@Auth('…')`, Next.js App Router frontend, dashboard UI kit, email through the existing `MailService` (Gmail SMTP in production; Mailpit locally; links shown on screen when email is off).
- Hosting: Vercel serverless backend (≈4.5 MB request limit, no disk), Vercel frontend, Neon free database (0.5 GB shared; media budget ~400 MB).
- Vercel free plan cron jobs: allowed, but run roughly once a day at an approximate time within the scheduled hour.
- Time zone for everything shown and entered: **Africa/Cairo**.
- QR scanning must work on iPhone Safari and Android Chrome (so not the browser-built-in barcode reader, which iPhones lack).

## Approaches considered

| Decision | Options | Picked | Why |
| --- | --- | --- | --- |
| Who can register | public form, no account · require an account | **Public form** | Accounts are invite-only and most attendees aren't members. |
| QR in the ticket email | attached image referenced from the email (cid) · image embedded in the HTML (data URL) · image loaded from our server | **Attached image** | Gmail blocks data-URL images; a server-hosted image would expose the ticket token in image logs and fails offline. A ticket web page with the QR is also provided. |
| Door scanning | camera + a small JS QR-reading library · browser's built-in barcode reader | **JS library** | The built-in reader isn't available on iPhones. |
| Reminders | Vercel daily cron · external scheduler · manual "send reminders" button | **Vercel daily cron** | Free, no new account; once-a-day precision is enough for "the day before". |
| Waitlist promotion | automatic · manual | **Automatic** (team's choice) | Seats never sit empty; nobody has to watch the list. Manual move-in is also available. |
| Cover photos | Neon (like Media) · external image service | **Neon**, counted in the media budget | No new service; consistent with the Media decision. |

## Design

### Permissions *(my call: two, so door volunteers needn't be able to edit events)*
- `events.manage` — create, edit, publish, delete events; see registrations; export CSV; move people in/out of the waitlist; everything `events.checkin` can do.
- `events.checkin` — see an event's registration list and check people in (scan or search). Read-only otherwise.

### Event
- Fields: title; category (free text with suggestions, like Media); description (plain text with line breaks); venue; start date & time; optional end date & time; optional cover photo; partners (a short list of names); optional capacity (empty = unlimited); registration enabled yes/no; optional registration deadline; published yes/no (drafts are hidden); optional linked Media album; optional "highlight" line (e.g. "Industry Certification"); optional manual attendance figure (for past events that predate check-in).
- **New events start as drafts.**
- **Changing an event that has registrations** *(my calls, from review)*:
  - **Delete** is only possible when nobody is registered. Otherwise the action is **Cancel event**: it emails all confirmed and waitlisted people, and the event shows "Cancelled" publicly (registration closed).
  - **Date, time or venue change:** saving offers "Tell registered people about this change" (ticked by default), which emails confirmed and waitlisted people the new details. A date change resets reminder tracking.
  - **Raising capacity** automatically promotes people from the waiting list into the new seats (ticket emails sent).
  - **Lowering capacity** below the number already confirmed is refused with a clear message.
  - **Unpublishing** an event with registrations is refused (use Cancel event instead).
  - A **manager cancelling a registration** emails that person and auto-promotes the next waitlisted person.
- **Timeline (automatic):** an event is *Upcoming* until it starts, *Happening now* between start and end (or for 3 hours after start when there's no end time — my call), then *Past*. Computed from the current time on every page build.
- **Registration is open** when: published, registration enabled, not past its deadline, and the event hasn't started (my call: registration closes at the start time even without a deadline).

### Registration (public, no account)
- Form (all required, as agreed): full name, email, phone, faculty, academic year. One active registration per email per event (registering again with the same email shows the existing ticket's status instead of a duplicate). Rate-limited per visitor, plus a hidden honeypot field to stop simple bots. *(My call.)*
- Outcomes:
  - Seats left (or no capacity): **Confirmed** → ticket email with QR.
  - Full: **Waitlisted** (with position) → "you're on the waiting list" email with a link to the ticket page (to cancel).
- Every registration has a **ticket page** at `/tickets/<code>` (the code is a long random secret, **stored as-is** so later emails and the dashboard can include it — readable only by the system and by `events.manage`/`events.checkin` holders, like the registrants' phone numbers; *my call, from review*): event details, status (confirmed / waitlisted with position / cancelled / checked in), the QR code when confirmed, and a **Cancel my registration** button.
- After submitting, the visitor lands on their ticket page directly (so it works even if the email is late or email is off).
- **Self-cancel** (ticket page): confirmed → cancelled frees the seat and **automatically promotes** the first waitlisted person (status → confirmed, ticket email sent). Cancelling is not allowed after the event has started.

### Spam protection — decided: light
Per-visitor rate limit, a hidden honeypot field, one active registration per email per event, and managers can remove junk registrations (which auto-promotes the waiting list). No CAPTCHA and no email-confirmation step. Accepted limitation: a determined person with a script could still fill an event or register a stranger's email.

### Emails (via MailService; in the club's existing email style)
- Ticket (on confirm and on promotion): event, date/time (Cairo), venue, QR code as an attached image, ticket link, cancel link.
- Waitlisted: position and ticket link.
- Reminder: the day before (see below), with ticket link and QR.
- If email is disabled, everything still works through the ticket page; the dashboard shows each person's ticket link.

### Reminders
- Two Vercel cron runs each morning (around **08:00 and 11:00 Cairo**; the free plan allows two scheduled jobs) call a protected backend endpoint. Each run emails **confirmed** registrations for events starting the **next calendar day (Cairo)** that haven't had a reminder yet, in small batches, stopping safely before the function time limit; each registration records when its reminder was sent, so nobody gets two. The second run catches anything the first couldn't finish. Protected by `CRON_SECRET` (Vercel sends it automatically). *(My call, from review.)*
- **Email volume:** the sender is a personal Gmail (~500 emails/day). Above roughly 300–400 registrations needing emails on one day, Gmail will refuse; the fix then is a dedicated email service (settings only). Unsent reminders are simply not sent; tickets remain available on the ticket page.

### Dashboard
- **Events** (holders of `events.manage`): list with Upcoming / Past / Drafts, counts (confirmed / capacity, waitlist, checked in), New event; event editor (all fields, cover upload, publish/unpublish, delete).
- **Registrations tab** of an event (`events.manage` or `events.checkin`): search; status filters; each person's details and status; actions for managers: move waitlisted → confirmed (allowed even past capacity, the manager decides), cancel someone; **Download CSV** (name, email, phone, faculty, year, status, registered at, checked in at).
- **Check-in screen** (`events.checkin` or `events.manage`), built for phones: big "Scan" camera view + search box. Scanning or picking a person shows their name and status in large type, then:
  - confirmed, not yet in → **Check in** (one tap), then ready for the next scan;
  - already checked in → clear warning with the time they were checked in;
  - waitlisted / cancelled / wrong event → clear warning, not checked in;
  - unknown code → "Not a valid ticket".
  - Live counter "84 / 120 checked in".

### Public pages
- **Events page:** Upcoming (soonest first; "Register" button or "Full — join the waiting list" or "Registration closed"), Happening now, Past timeline (newest first) with attendance ("120 attended" from check-ins, or the manual figure), highlight, partners and "See the photos" when linked to a Media album.
- **Event page** `/events/<id>`: cover, all details, map-free venue text, registration form or status, "Add to calendar" isn't included (non-goal; my call).
- **Home page:** replaces the hard-coded event card with the next up to 3 upcoming events and a **countdown** to the next one; when nothing is upcoming, a short message linking to past events.
- Public pages refresh from the API at most every 60 seconds (like Media); seat counts and registration status on the event page itself are always live (fetched in the browser) so people never register into a stale "seats left".

### Existing content (day one)
- A migration recreates today's real past events as published events: Orientation Day 2025 (23 Jun 2025), Battery Tech with Schneider Electric 2025 (17 Jul 2025), AI Catalyst with Dotpy 2025 (22 Aug 2025, attendance 200+ as the manual figure), Season Orientation 2026 (1 Mar 2026, Main Hall, Capital University), with their descriptions and highlights. "Board Recruitment 2026" is not an event and is dropped (recruitment is a separate feature). *(My call.)*

### Privacy
- Registrants' personal data is visible only to `events.manage` / `events.checkin` holders and the registrant's own ticket page (name only + status). The public sees counts, never names.

## Left to the builder

Table design, endpoint shapes, which QR generation and scanning libraries (small, maintained, MIT-style licence), exact UI layout following the dashboard style, CSV formatting details (UTF-8 with BOM so Excel shows Arabic names), test coverage, and how the countdown renders.

## Review notes

A builder read this document before approval and raised four gaps:
1. Protection against fake sign-ups → **the team chose light protection** (above).
2. Ticket codes stored only as a hash, yet needed later for emails and the dashboard → codes stored as-is (my call).
3. Email volume vs. personal Gmail limits and serverless time limits → batched reminders with per-registration tracking, two morning runs, documented limit (my call).
4. Effects of editing/cancelling/capacity changes on existing registrants → rules above (my calls).
