# Custom registration forms per event — design

Date: 2026-11-19 · Branch: `feature/events` (builds on the events feature) · Status: approved in conversation

## Intent

Every event currently asks the same five things (name, email, phone, faculty, year). Different events
need different information — a hackathon wants a track and a GitHub link, a workshop wants "do you have a
laptop?", a competition wants a CV as a Google Drive link. The publisher of an event (anyone with
`events.manage`, which includes the President) builds that event's registration form themselves, the way
they would in Google Forms.

## Goals

- A **Form** tab in the dashboard event page (next to Details / Registrations), `events.manage` only.
- Two fixed fields that can't be removed or edited: **Full name** and **Email** (email = duplicate check +
  where the ticket goes; name = what the door screen shows).
- Every event starts with three ordinary, editable, removable questions: **Phone** (short answer),
  **Faculty** (short answer), **Academic year** (short answer) — all required, matching today's form.
- Question types:
  - Short answer, Paragraph
  - Multiple choice (one), Checkboxes (many), Dropdown (one) — with an options list and optional "Other"
    (which adds a free-text box)
  - Number, Date
  - **Link** — must be an `http(s)` URL; a per-question switch **"Google Drive links only"** restricts it to
    `drive.google.com` / `docs.google.com` hosts and shows the hint "Make sure the file is shared as
    'Anyone with the link'".
- Each question: title, optional help text, required switch. Builder actions: add, duplicate, delete,
  move up / down, **Preview** (shows the form exactly as students see it).
- The public event page renders that event's form; the server validates answers against the form
  (required, type, option membership, link rules) and rejects bad input with a clear message per question.
- Board registrations list: each row expands to show that person's answers (links clickable).
- CSV: fixed columns (Name, Email, Status, Registered at, Checked in at) + one column per question, in form
  order; then columns for **deleted questions that still have answers**, titled "<title> (removed)".
  Checkboxes answers joined with "; ".
- Editing after people registered is allowed. A question's **type can't change** once anyone answered it
  (the editor disables the type picker and explains why). Deleting a question keeps old answers (CSV only).
  Existing answers are never rewritten.

## Non-goals

File uploads (decided: Drive links instead), multiple pages/sections, conditional "go to question" logic,
quiz scoring, response limits per option, form templates/copy-from-event (could come later), Arabic UI.

## Anti-goals

- Breaking existing events/registrations: today's registrations keep their phone/faculty/year answers,
  visible in the list and CSV.
- Losing answers when a publisher edits the form.
- Letting a crafted request store answers to questions that don't exist, or skip required ones.

## Constraints

- Stack as today: NestJS + Drizzle + Postgres (Neon / PGlite / Docker), Next.js App Router + Tailwind.
- Migrations are SQL strings in `backend/src/db/migrations.ts`.
- Registration stays a JSON POST (no multipart) and keeps the honeypot + 30/min/IP throttle.

## Approaches

1. **Form as JSON on the event, answers as JSON on the registration (chosen).** `events.form jsonb`
   (ordered question list) and `event_registrations.answers jsonb` (`{questionId: value}`). One read gives
   the whole form; no join tables; fits a "one form per event, edited as a whole" model.
2. Normalised tables (`event_questions`, `event_answers`). Queryable per answer, but every save/edit is a
   multi-row diff and the CSV needs pivoting — more code for no user-visible gain at this size.
3. Keep fixed columns and add only "extra questions". Least work but can't remove phone/faculty/year,
   which the request needs.

## Design decisions

- **Question shape:** `{ id (short random string, stable), type, title (1–200), help? (≤500), required,
  options? (1–30 strings, each 1–100, unique) for choice types, other? (bool) for choice types,
  driveOnly? (bool) for link }`. Max 30 questions per form.
- **Default form ids:** `phone`, `faculty`, `year` (so the migration can map old columns to answers).
- **Migration 008:** add `events.form jsonb NOT NULL DEFAULT <default three questions>`; add
  `event_registrations.answers jsonb NOT NULL DEFAULT '{}'`; backfill answers from phone/faculty/year;
  drop those three columns; add `events.removed_questions jsonb NOT NULL DEFAULT '{}'`.
- **Answer storage:** short/paragraph/number/date/link/dropdown/multiple choice → string; checkboxes →
  string array. "Other" text is stored as the answer itself (for checkboxes as one of the array items);
  the list and CSV show it as written.
- **Validation (server, authoritative):** unknown keys rejected; required → non-empty; short ≤ 300 chars,
  paragraph ≤ 3000; number → finite number string; date → `YYYY-MM-DD`; choice → one of the options, or
  any non-empty text ≤ 200 when `other` is on; link → valid `http(s)` URL ≤ 500, and Drive host when
  `driveOnly`. Errors name the question title.
- **Form save:** `PUT /api/admin/events/:id/form` with the full question list (`events.manage`). Server
  validates the shape and refuses a type change for a question id that has answers (409 with the title).
- **Public:** `GET /api/events/:id` includes `form`. `POST /api/events/:id/register` body becomes
  `{ name, email, answers, website }`.
- **Board list** (`/admin/events/:id/registrations`) returns `form`, each registration's `answers`, and
  `removedQuestions` (title + id for answered-but-deleted questions; their titles are kept in an
  `events.removed_questions jsonb` map `{id: title}` written when a question with answers is deleted).
- **Check-in volunteers** (`events.checkin` only) get name/email/status only — no answers (they don't need
  them; keeps personal data to managers).
- **Search** on the check-in screen stays name/email.

## Builder's calls (from the pre-plan check)

- "Has answers" (for the type lock and for keeping removed titles) counts any registration with a
  non-empty answer, whatever its status.
- Number accepts any finite decimal string.
- Optional questions left blank are omitted from `answers` (no empty strings stored).
- Two managers saving the form at once: last write wins.

## Left to the builder

Exact editor layout and styling (follow the dashboard `ui.tsx` components), id generation, how Preview is
presented (modal or inline), error copy beyond the rules above.
