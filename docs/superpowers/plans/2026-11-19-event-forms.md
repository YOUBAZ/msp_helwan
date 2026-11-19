# Custom Registration Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each event's publisher builds that event's registration form (Google-Forms-like); students fill it on the event page; the board sees answers in the list and CSV.

**Architecture:** The form is an ordered JSON question list on `events.form`; answers are JSON on `event_registrations.answers`. One pure module (`backend/src/events/forms.ts`) owns question/answer types, defaults and validation and is used by the API; the frontend mirrors the types and renders the form from them.

**Tech Stack:** NestJS 11, Drizzle, Postgres/PGlite, class-validator; Next.js 15 App Router, Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-19-event-forms-design.md`

## Global Constraints

- Fixed fields: **Full name** and **Email**, always first, not editable/removable.
- Default form = `phone` "Phone", `faculty` "Faculty", `year` "Academic year"; all `short`, all required.
- Types: `short`, `paragraph`, `choice` (multiple choice), `checkboxes`, `dropdown`, `number`, `date`, `link`.
- Limits: ≤ 30 questions; title 1–200; help ≤ 500; options 1–30 unique, each 1–100 (choice types only); short answer ≤ 300; paragraph ≤ 3000; "Other" text ≤ 200; link ≤ 500 http(s).
- Drive-only link hosts: exactly `drive.google.com` or `docs.google.com`. Hint text: "Make sure the file is shared as 'Anyone with the link'".
- Type can't change for a question that has any non-empty answer (any status). Deleting keeps answers; CSV column "<title> (removed)".
- Optional blank answers are omitted (no empty strings). Checkboxes stored as string array, joined with "; " in CSV.
- `events.checkin`-only users get no answers. Form editing requires `events.manage`. Last write wins.
- Registration stays a JSON POST with honeypot `website` and the 30/min/IP throttle.
- Frontend files are not prettier-formatted: never run prettier on `frontend/`.

## Review Focus

1. Registrations made before this change → their phone/faculty/year still show in list and CSV (Task 2 test `migration 008 moves phone/faculty/year into answers`).
2. A link like `https://drive.google.com.evil.com/x` on a Drive-only question → rejected (Task 1 test).
3. A student submits with the page open while the form was edited (answer to a deleted question / missing new required one) → clear "This form was updated — please reload the page" for unknown keys; per-question message for missing required (Task 1 tests).
4. Required checkboxes with nothing ticked, or "Other" ticked with empty text → rejected naming the question (Task 1 test).
5. Question deleted and a new one added with the same title → old answers appear as "<title> (removed)", new ones in the live column (Task 3 test).

---

### Task 1: Form model and validation (pure)

**Files:**
- Create: `backend/src/events/forms.ts`
- Test: `backend/src/events/forms.spec.ts`

**Interfaces:**
- Produces:
  - `type QuestionType = 'short'|'paragraph'|'choice'|'checkboxes'|'dropdown'|'number'|'date'|'link'`
  - `type Question = { id: string; type: QuestionType; title: string; help?: string; required: boolean; options?: string[]; other?: boolean; driveOnly?: boolean }`
  - `type Answers = Record<string, string | string[]>`
  - `DEFAULT_FORM: Question[]`
  - `DRIVE_HINT: string`
  - `parseForm(input: unknown): Question[]` — throws `BadRequestException` with a human message; strips `options`/`other` from non-choice types and `driveOnly` from non-link; trims strings; ids must match `/^[A-Za-z0-9_-]{1,40}$/` and be unique.
  - `validateAnswers(form: Question[], input: unknown): Answers` — returns cleaned answers (trimmed, blanks omitted) or throws `BadRequestException`. Unknown key → "This form was updated — please reload the page." Other errors name the question title, e.g. `"Which track?" is required.`

- [ ] **Step 1: Write failing tests** in `forms.spec.ts`:
  - `DEFAULT_FORM` ids are `['phone','faculty','year']`, all required `short`.
  - `parseForm` rejects: 31 questions; duplicate ids; `choice` with no options; duplicate options; title `''`; unknown type. Accepts and strips `driveOnly` from a `short` question.
  - `validateAnswers`:
    - required short missing → throws `/"Phone" is required/`
    - optional blank `'  '` → key omitted
    - choice value not in options and `other: false` → throws; with `other: true` → accepted as written
    - checkboxes required `[]` → throws; `['AI','']` with other → throws (empty other)
    - checkboxes non-array → throws
    - number `'12.5'` ok, `'abc'` and `'Infinity'` throw
    - date `'2026-11-20'` ok, `'20/11/2026'` throws
    - link `'ftp://x'` throws; driveOnly `'https://drive.google.com/file/d/1'` ok, `'https://docs.google.com/document/d/1'` ok, `'https://drive.google.com.evil.com/x'` throws, `'https://example.com'` throws
    - unknown key `{ ghost: 'x' }` → throws `/reload the page/`
    - short of 301 chars throws; paragraph of 3001 throws

- [ ] **Step 2: Run** `cd backend && npx jest src/events/forms.spec.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `forms.ts`** per Interfaces. Host check via `new URL(v).hostname` exact match.
- [ ] **Step 4: Run** same command — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(events): registration form model and validation`

### Task 2: Storage, migration, register with answers, list/CSV/public

**Files:**
- Modify: `backend/src/db/migrations.ts` (add `008_event_forms`), `backend/src/db/schema.ts`, `backend/src/events/dto.ts` (`RegisterDto`), `backend/src/events/registrations.service.ts` (`register`, `boardList`, `csv`), `backend/src/events/serialize.ts` (`PublicEvent.form`), `backend/src/events/events.service.ts` if it builds public events
- Test: `backend/test/app.e2e-spec.ts`, Create: `backend/test/migration-008.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 `Question`, `Answers`, `DEFAULT_FORM`, `validateAnswers`.
- Produces:
  - Schema: `events.form: Question[]` (`jsonb`, not null), `events.removedQuestions: Record<string,string>` (`jsonb`, not null, default `{}`), `eventRegistrations.answers: Answers` (`jsonb`, not null, default `{}`); `phone/faculty/year` columns removed.
  - `RegisterDto { name; email; answers: Record<string, unknown>; website }` (name/email rules unchanged).
  - `PublicEvent.form: Question[]` (public `GET /api/events/:id` and list items).
  - `boardList(eventId, canManage)` → `{ event, form, removedQuestions: {id,title}[], registrations: { id,name,email,status,position,ticketUrl?,answers?,createdAt,checkedInAt }[] }` — `form`, `removedQuestions`, `answers` only when `canManage` (else `form: []`, `removedQuestions: []`, no `answers`).
  - CSV header: `Name,Email,<question titles…>,<removed titles + " (removed)">,Status,Registered at,Checked in at`; removed columns only for ids present in `removedQuestions`.
- Migration `008_event_forms` SQL (order matters):
  1. `ALTER TABLE events ADD COLUMN form jsonb NOT NULL DEFAULT '<DEFAULT_FORM as JSON literal>'::jsonb;`
  2. `ALTER TABLE events ADD COLUMN removed_questions jsonb NOT NULL DEFAULT '{}'::jsonb;`
  3. `ALTER TABLE event_registrations ADD COLUMN answers jsonb NOT NULL DEFAULT '{}'::jsonb;`
  4. `UPDATE event_registrations SET answers = jsonb_build_object('phone', phone, 'faculty', faculty, 'year', year);`
  5. `ALTER TABLE event_registrations DROP COLUMN phone, DROP COLUMN faculty, DROP COLUMN year;`

- [ ] **Step 1: Write failing tests**
  - `migration-008.e2e-spec.ts` → `migration 008 moves phone/faculty/year into answers`: open a PGlite in memory, run every migration before `008_event_forms` (split on `;\n` as `openDatabase` does), insert one event and one registration with phone `'+20 1'`, faculty `'CS'`, year `'3'`, run 008, assert `answers = {phone:'+20 1',faculty:'CS',year:'3'}`, `form` ids = `['phone','faculty','year']`, and column `phone` no longer exists.
  - e2e: change the `student()` helper to send `{ name, email, answers: { phone, faculty, year }, website: '' }` (all existing tests keep passing with the default form).
  - e2e `registers with the event's form answers`: `GET /api/events/:id` has `form` ids `['phone','faculty','year']`; register missing `year` → 400 `/"Academic year" is required/`; register with `answers.ghost` → 400 `/reload the page/`; valid → 201; president's board list row has `answers.faculty === 'Computer Science'`; volunteer's list row has no `answers` and `form` is `[]`.
  - e2e `CSV has a column per question`: header starts `Name,Email,Phone,Faculty,Academic year,Status`.
- [ ] **Step 2: Run** `cd backend && npm run -s test:e2e` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** migration + schema + DTO + service + serializer per Interfaces. `register` loads the event's `form` and calls `validateAnswers` before inserting.
- [ ] **Step 4: Run** `cd backend && npm run -s test:e2e && npx jest src/events` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(events): store registration answers per event form`

### Task 3: Save form endpoint (type lock, removed questions)

**Files:**
- Modify: `backend/src/events/events.controller.ts` (`AdminEventsController`), `backend/src/events/registrations.service.ts` (new `saveForm`), `backend/src/events/serialize.ts` (`AdminEvent.form`)
- Test: `backend/test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 `parseForm`; Task 2 schema.
- Produces: `PUT /api/admin/events/:id/form` body `{ questions: Question[] }` → 200 `{ form: Question[] }`, `@Auth('events.manage')`. `RegistrationsService.saveForm(eventId: string, input: unknown): Promise<Question[]>`. `AdminEvent.form: Question[]` and `AdminEvent.answeredQuestionIds: string[]` (ids with any non-empty answer, so the editor can lock the type picker).
- Rules: for each incoming question whose id has answers and whose stored type differs → 409 `You can't change the type of "<title>" because people already answered it.` For each stored question removed in the new list that has answers → add `{id: title}` to `removed_questions`. A removed id that comes back (same id) is deleted from `removed_questions`.

- [ ] **Step 1: Write failing tests** (e2e):
  - `the publisher edits the form`: PUT a form with `phone` (short), new `track` (`choice`, options `['AI','Web']`, required) → 200; `GET /api/events/:id` form ids `['phone','track']`; volunteer PUT → 403; register with `track: 'Cloud'` → 400; `track: 'AI'` → 201.
  - `locks the type of answered questions`: after a registration answering `phone`, PUT `phone` as `paragraph` → 409 `/can't change the type of "Phone"/`; admin event has `answeredQuestionIds` containing `'phone'`.
  - `keeps answers to removed questions in the CSV`: register with `faculty: 'Engineering'`; PUT without `faculty`, plus a new question id `fac2` titled `Faculty`; register another; CSV header contains `Faculty,Faculty (removed)` in that order (live, then removed) and the first row contains `Engineering`.
  - invalid shapes: PUT 31 questions → 400.
- [ ] **Step 2: Run** `cd backend && npm run -s test:e2e` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** endpoint + `saveForm` (in one transaction with `lockEvent`) + `answeredQuestionIds` (SQL: distinct `jsonb_object_keys(answers)` for the event).
- [ ] **Step 4: Run** `cd backend && npm run -s test:e2e` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(events): publishers edit each event's registration form`

### Task 4: Public form rendering

**Files:**
- Modify: `frontend/src/lib/types.ts` (add `Question`, `QuestionType`, `Answers`; `PublicEvent.form`; `AdminEvent.form`, `AdminEvent.answeredQuestionIds`)
- Create: `frontend/src/components/events/FormFields.tsx`
- Modify: `frontend/src/components/events/RegistrationBox.tsx`

**Interfaces:**
- Consumes: Task 2/3 JSON shapes.
- Produces: `FormFields({ form, answers, onChange, idPrefix }: { form: Question[]; answers: Answers; onChange: (a: Answers) => void; idPrefix: string })` — renders each question (label with `*` when required, help text, Drive hint under Drive-only links, "Other" text box for choice types), used by RegistrationBox and by Task 5's Preview.

- [ ] **Step 1:** Add types; build `FormFields` (native inputs: `input[type=text|number|date|url]`, `textarea`, radio group, checkbox group, `select`; "Other" radio/checkbox reveals a text input whose value becomes the answer).
- [ ] **Step 2:** RegistrationBox: fixed Full name + Email, then `<FormFields>`; POST `{ name, email, answers, website }`; keep honeypot and the existing duplicate/429 handling.
- [ ] **Step 3: Verify** `cd frontend && npm run -s lint && npx tsc --noEmit` — Expected: no output errors.
- [ ] **Step 4: Commit** `feat(events): event page shows the event's own form`

### Task 5: Dashboard form builder, preview, answers in the list

**Files:**
- Create: `frontend/src/components/dashboard/FormBuilder.tsx`
- Modify: `frontend/src/app/dashboard/events/[id]/page.tsx` (add **Form** tab for `manage`; expandable answers per registration row; removed-question answers shown labeled "(removed)")

**Interfaces:**
- Consumes: Task 3 `PUT /admin/events/:id/form`, `AdminEvent.form`, `answeredQuestionIds`; Task 4 `FormFields`, types.
- Produces: `FormBuilder({ event, onSaved }: { event: AdminEvent; onSaved: () => void })`.

- [ ] **Step 1:** FormBuilder: locked Full name/Email rows; question cards with title, type select (disabled with tooltip "People already answered this question" when id ∈ `answeredQuestionIds`), help, required switch, options editor + "Add 'Other'" for choice types, "Google Drive links only" switch for link; actions add / duplicate / delete (confirm if answered: "Answers stay in the CSV.") / move up / move down; **Preview** modal rendering `FormFields`; **Save form** → PUT, shows server errors. New ids: `crypto.randomUUID().slice(0, 8)`.
- [ ] **Step 2:** Registrations tab: a "Answers" toggle per row showing question title → answer (links open in new tab with `rel="noopener noreferrer"`; arrays joined with ", ").
- [ ] **Step 3: Verify** `cd frontend && npm run -s lint && npx tsc --noEmit`.
- [ ] **Step 4: Commit** `feat(events): form builder and answers in the dashboard`

### Task 6: Browser verification

- [ ] Run isolated servers (frontend copy on :3601, backend on :4601 with memory DB, Mailpit SMTP), Playwright: build a form (choice "Track" required, Drive-only link "CV", delete Faculty) → Preview → save; student registers on desktop and 390px (Drive link validation message, required message, success); board sees answers; CSV columns; volunteer sees no answers; zero console errors. Stop only the servers you started.
- [ ] Ledger the results. Expected: every step passes.
