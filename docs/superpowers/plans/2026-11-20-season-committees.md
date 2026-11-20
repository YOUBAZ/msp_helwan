# Season Committees Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Committees belong to seasons, are managed from the dashboard with a `committees.manage` permission (CRUD, reorder, copy from the previous season), and the public page shows the current and previous season.

**Architecture:** New `committees` table keyed by `season_id` (seasons from the hierarchy module); a `CommitteesModule` with a public controller and an admin controller; the public page becomes a server component fetching the API (revalidate 60); a dashboard page edits per season.

**Tech Stack:** NestJS 11, Drizzle, Postgres/PGlite; Next.js 15, Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-20-season-committees-design.md`

## Global Constraints

- Permission key `committees.manage`, group "Committees", label "Manage each season's committees (Committees page)".
- Tracks: `technical` | `non_technical`. Name 2–80, description ≤ 300, tasks 0–12 items of 1–80 chars.
- Icon keys exactly: brain, layout, database, shield, smartphone, cloud, lock, zap, users, megaphone, trending, video, calendar, briefcase, code, palette, pen, camera, gamepad, cpu, globe, heart, book, star.
- Unique committee name per season, case-insensitive → 409 "A committee with this name already exists in <Season name>."
- Archived seasons are read-only → 400 "<Season name> is archived and can't be changed."
- Draft seasons never appear publicly. Seed only Season 26 (id `00000000-0000-4000-8000-000000000026`); never insert a season.
- Never run prettier on `frontend/`.

## Review Focus

1. Copying a committee whose name already exists in the target season → 409, nothing half-copied (Task 2 test).
2. Copy source from the same or a later season, or from a draft season → refused 400 (Task 2 test).
3. Current season with zero committees → public page falls back to the previous season with `fallback: true` (Task 1 test).
4. Moving the first committee of a track up / last down → no-op 200, order unchanged; move never crosses tracks (Task 2 test).
5. Only one non-draft season exists (today's production) → public `seasons` has one entry, no previous switch (Task 1 unit test of `pickSeasons`).

---

### Task 1: Storage, seed, public endpoint

**Files:**
- Modify: `backend/src/db/migrations.ts` (add `009_committees`), `backend/src/db/schema.ts`, `backend/src/access/permissions.ts`, `backend/src/app.module.ts`
- Create: `backend/src/committees/committees.module.ts`, `committees.service.ts`, `committees.controller.ts`, `icons.ts`
- Test: `backend/test/app.e2e-spec.ts` (new `describe('committees')`)

**Interfaces:**
- Produces:
  - `COMMITTEE_ICONS: readonly string[]` (the 24 keys) in `icons.ts`.
  - Schema `committees` (`id, seasonId, name, track, icon, description, tasks: string[], sortOrder, createdAt`).
  - Type `Committee = { id; name; track: 'technical'|'non_technical'; icon; description; tasks: string[]; sortOrder }`.
  - `GET /api/committees?season=<number>` → `{ seasons: {number:number,name:string}[]; season: {number,name} | null; committees: Committee[]; fallback: boolean }` — `seasons` = current (or newest non-draft) + the previous non-draft by number (max 2, newest first); committees ordered by track (technical first) then sortOrder; unknown/draft season number → 404.
- Migration `009_committees`: create table + `CREATE UNIQUE INDEX committees_season_name ON committees(season_id, lower(name))` + `CREATE INDEX committees_season_idx ON committees(season_id)`; insert the 15 committees from `frontend/src/data/committees.ts` into Season 26 with icon keys mapped (BrainCircuit→brain, Layout→layout, Database→database, ShieldCheck→shield, Smartphone→smartphone, CloudCog→cloud, Lock→lock, Zap→zap, Users→users, Megaphone→megaphone, TrendingUp→trending, Video→video, Calendar→calendar, Briefcase→briefcase), sort_order by file order within each track. Permission added to `PERMISSIONS`.

- [ ] **Step 1: Failing tests.** Note: `describe('committees')` goes at the end of the e2e file, after the hierarchy tests have published Season 27 (26 archived).
  - Unit `backend/src/committees/pick-seasons.spec.ts` for `pickSeasons(rows: {number:number; status:string}[]): {current: number|null; previous: number|null}` (pure, in `pick-seasons.ts`): only `[{26,'archived'}]` → `{current:26, previous:null}`; `[{27,'current'},{26,'archived'},{28,'draft'}]` → `{27, 26}`; no current, `[{25,'archived'},{24,'archived'}]` → `{25, 24}`; `[]` → `{null,null}`.
  - e2e `seeds last season's 15 committees`: `GET /api/committees?season=26` → 15 committees, first `{ name: 'AI & Data Science', track: 'technical', icon: 'brain' }`, 8 technical then 7 non-technical.
  - e2e `falls back to the previous season while the current one is empty`: `GET /api/committees` → `season.number === 26`, `fallback === true`, `seasons.map(s=>s.number)` = `[27, 26]`; `GET /api/committees?season=27` → `committees: []`, `fallback === false`.
  - e2e `hides draft seasons`: create draft Season 28 (president, `/api/admin/seasons`) → `GET /api/committees?season=28` → 404.
  - e2e `GET /api/permissions` includes `committees.manage`.
- [ ] **Step 2: Run** `cd backend && npm run -s test:e2e && npx jest src/committees` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** `pickSeasons`, migration, schema, icons, service `publicView(number?: number)`, public controller, module wiring, permission.
- [ ] **Step 4: Run** `cd backend && npm run -s test:e2e` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(committees): season committees storage and public API`

### Task 2: Admin CRUD, reorder, copy

**Files:**
- Modify: `backend/src/committees/committees.service.ts`, `committees.controller.ts`; Create: `backend/src/committees/dto.ts`
- Test: `backend/test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 schema, `COMMITTEE_ICONS`, `Committee`.
- Produces (all `@Auth('committees.manage')`):
  - `GET /api/admin/committees/seasons` → `{id,number,name,status}[]` newest first.
  - `GET /api/admin/seasons/:id/committees` → `{ season: {id,number,name,status}; committees: Committee[]; previous: {id,number,name} | null; previousCommittees: Committee[] }` (previous = highest-numbered season below it, any status).
  - `POST /api/admin/seasons/:id/committees` body `CommitteeDto {name, track, icon, description, tasks}` → 201 `Committee` (appended last in its track).
  - `PATCH /api/admin/committees/:id` body partial `CommitteeDto` → 200 `Committee` (changing track appends it last in the new track).
  - `DELETE /api/admin/committees/:id` → 204.
  - `POST /api/admin/committees/:id/move` `{direction:'up'|'down'}` → 200 `Committee[]` of that season (swap with neighbour in same track; edge = no-op).
  - `POST /api/admin/seasons/:id/committees/copy` `{committeeId, name?}` → 201 `Committee`; source must be in a season with a lower number than the target, else 400 "You can only copy from an earlier season."
  - All writes refuse archived target seasons (constraint copy).

- [ ] **Step 1: Failing e2e tests:**
  - `requires committees.manage`: a role with only `members.view` → 403 on `GET /api/admin/committees/seasons` and `POST .../committees`.
  - `manages a season's committees`: create draft Season 29; POST `{name:'Game Dev', track:'technical', icon:'gamepad', description:'Make games.', tasks:['Unity','Godot']}` → 201; PATCH name `'Game Development'` → 200; second technical `'Robotics'` (icon `cpu`) → move Robotics up → order `['Robotics','Game Development']`; move Robotics up again → unchanged; bad icon `'rocket'` → 400; 13 tasks → 400; duplicate name `'game development'` → 409 `/already exists in Season 29/`; DELETE Robotics → 204.
  - `copies from an earlier season`: on Season 29, `GET .../committees` → `previous.number === 28` (Task 1's draft); copy Season 26's `'Marketing'` with `name: 'Marketing & Content'` → 201, fields equal except name; copy `'Marketing'` again without name, then again → second gives 409; copy a Season 29 committee into Season 26 → 400 (archived) and into Season 28 when source is 29 → 400 "earlier season".
  - `refuses edits to archived seasons`: PATCH a Season 26 committee → 400 `/archived/`.
- [ ] **Step 2: Run** `cd backend && npm run -s test:e2e` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** DTOs (class-validator, `IsIn(COMMITTEE_ICONS)`, `ArrayMaxSize(12)`), service methods (move in a transaction with `SELECT … FOR UPDATE` on the season's committees), unique violation → 409 via existing `uniqueViolation`.
- [ ] **Step 4: Run** `cd backend && npm run -s test:e2e` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(committees): manage, reorder and copy committees`

### Task 3: Public Committees page

**Files:**
- Create: `frontend/src/lib/committees.ts` (`COMMITTEE_ICONS: Record<string, LucideIcon>`, `fetchCommittees(season?: number)` with `revalidate: 60`)
- Modify: `frontend/src/lib/types.ts` (`Committee`, `CommitteesView`), `frontend/src/app/committees/page.tsx` (reads `searchParams.season`, season switch links `?season=N`, "coming soon" note when `fallback`, same card look, unknown icon → `Users`)
- Delete: `frontend/src/data/committees.ts`

- [ ] **Step 1:** Implement per Files. Season switch: two pill links (current, previous) only when `seasons.length > 1`. API down → "Committees couldn't be loaded right now."
- [ ] **Step 2: Verify** `cd frontend && npm run -s lint && npx tsc --noEmit` — Expected: no errors; `grep -rn "data/committees" frontend/src` → nothing.
- [ ] **Step 3: Commit** `feat(committees): public page reads each season's committees`

### Task 4: Dashboard Committees page

**Files:**
- Create: `frontend/src/app/dashboard/committees/page.tsx`, `frontend/src/components/dashboard/CommitteeDialog.tsx`
- Modify: `frontend/src/app/dashboard/layout.tsx` (nav item "Committees", perm `committees.manage`, icon `Layers`), dashboard overview shortcut if the pattern exists

**Interfaces:**
- Consumes: Task 2 endpoints, Task 3 `COMMITTEE_ICONS`, `Committee` type.

- [ ] **Step 1:** Page: season `<select>` (defaults to current, else newest draft, else newest), status badge; archived → read-only note; Technical / Non-technical sections with cards (icon, name, description, tasks) and actions edit / move up / move down / delete (confirm); "Add committee" and "Copy from Season N" buttons. CommitteeDialog: name, track (2 radio), icon grid (24 buttons, `aria-pressed`), description textarea (300), tasks editor (add/remove rows, max 12). Copy dialog: list of the previous season's committees, each with a name field prefilled with its current name and a "Copy" button; server 409 shown inline. No seasons editable → note with link to `/dashboard/hierarchy` when `can('seasons.manage')`.
- [ ] **Step 2: Verify** `cd frontend && npm run -s lint && npx tsc --noEmit`.
- [ ] **Step 3: Commit** `feat(committees): dashboard to manage each season's committees`

### Task 5: Browser verification

- [ ] Isolated servers (backend :4601 memory DB, frontend copy :3601): public page shows Season 26 (15 cards, 390px no overflow); president creates + publishes Season 27 in Team Hierarchy → public page falls back with "coming soon" + switch; dashboard: copy "Marketing" renamed, add a new committee with icon + tasks, reorder, delete; public page (after revalidate) shows Season 27 with switch to 26; a role with only committees.manage sees the nav item and can edit; archived Season 26 read-only. Zero console errors. Stop only servers you started.
