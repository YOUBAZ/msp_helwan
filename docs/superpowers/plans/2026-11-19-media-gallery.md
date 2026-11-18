# Media Gallery (dashboard-managed) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let holders of a new `media.manage` permission create, edit, reorder, hide and delete Media albums (photos stored in Postgres, videos as YouTube/Facebook/Drive links), and drive the public `/media` page from the database.

**Architecture:** New NestJS `media` module (Drizzle tables `media_albums`, `media_items`, `media_blobs`) with public read endpoints and `@Auth('media.manage')` admin endpoints; photos uploaded as two browser-made JPEG versions (full ≤1600 px, small ≤600 px) stored as `bytea`. Next.js `/media` becomes a server component fetching published albums; a new dashboard section manages them. A one-time script copies the 37 legacy photos into the database.

**Tech Stack:** NestJS 11, Drizzle ORM, PostgreSQL (Neon / PGlite / Docker), Next.js 15 App Router, Tailwind v4, `sharp` (script only, dev dependency).

**Spec:** `docs/superpowers/specs/2026-11-19-media-gallery-design.md`

## Global Constraints

- Permission key `media.manage`, group `Media`, label `Manage the Media page (albums, photos and videos)`.
- Media budget: `MEDIA_BUDGET_BYTES` env, default `400 * 1024 * 1024`; warning at 80 %; refuse uploads at 100 % with `Media storage is full: remove photos or move to a bigger storage plan.` (HTTP 413).
- Per-version upload limit 2 MB; only JPEG/PNG/WebP by magic bytes (reuse `sniffImage` from `backend/src/access/profile.ts`).
- Public photo responses: `Cache-Control: public, max-age=3600, s-maxage=3600`. Token-authorised (dashboard) responses: `Cache-Control: private, no-store`.
- New albums: hidden, placed at the top (smallest `sort_order`). New items: appended at the end.
- Only normalised embed URLs from `parseVideoLink` are ever rendered in an iframe.
- Albums with zero items are not shown publicly even if published (my call, see Review Focus 5).
- Follow existing patterns: migrations as SQL strings in `backend/src/db/migrations.ts` (no `;` inside strings), `reorder` swap logic like `HierarchyService.reorder`, dashboard UI kit in `frontend/src/components/dashboard/ui.tsx`.
- Every change must pass: backend `npx tsc --noEmit`, `npx eslint "src/**/*.ts" "test/**/*.ts"`, `npm test`, `npm run test:e2e`; frontend `npm run lint`, `npx tsc --noEmit`.

## Review Focus

1. **Phone photos the browser can't decode (e.g. iPhone HEIC in Chrome)** → that file is listed as failed with "This image couldn't be read. Try a JPG or PNG.", the rest still upload. (Task 6 browser check.)
2. **Uploading a batch that crosses the budget** → photos before the limit are kept; the first refused one shows the "storage is full" message and the remaining ones are not attempted. (Task 3 e2e test `refuses uploads over the media budget`, Task 6 behaviour.)
3. **Guessing a hidden album's photo URL** → 404 without a token; 200 with a valid dashboard token. (Task 3 e2e test.)
4. **Video links with extra parameters** (`watch?v=ID&t=30s`, `youtu.be/ID?si=x`, `m.youtube.com`, `/shorts/ID`) parse; any other site (`vimeo.com`, `javascript:`) is refused. (Task 2 unit tests.)
5. **Published album emptied of all items** → disappears from the public page instead of showing a broken card. (Task 3 e2e test.)

---

### Task 1: Schema, migration, permission

**Files:**
- Modify: `backend/src/db/migrations.ts` (append `004_media`), `backend/src/db/schema.ts`, `backend/src/access/permissions.ts`
- Test: `backend/test/app.e2e-spec.ts`

**Interfaces:**
- Produces tables (Drizzle names): `mediaAlbums` {id, title, category, eventDate: string|null (date), published: boolean, sortOrder: int, createdAt, updatedAt}; `mediaItems` {id, albumId (cascade), kind: 'photo'|'video', sortOrder, legacyPath: string|null, videoProvider: 'youtube'|'facebook'|'drive'|null, embedUrl, thumbnailUrl, sourceUrl (nullable text), createdAt}; `mediaBlobs` {itemId (cascade), variant: 'full'|'small', mime, data: bytea, bytes: int; PK (itemId, variant)}.
- Seed: 4 published albums with sort_order 0..3 — `Orientation Day 2025`/`Event`, `AI Catalyst 2025`/`Workshop`, `Problem Solving Competition 2025`/`Contest`, `Best Heads & Members 2025`/`Awards` — and photo items with `legacy_path` `/images/events/<orientation|ai|problem|best>/<n>.jpg`, n = 1..12, 1..8, 1..5, 1..12 in numeric order.

- [ ] **Step 1:** Add e2e test `ships the 4 existing albums` asserting `GET /api/media/albums` returns titles in that order with item counts `[12, 8, 5, 12]` (fails: route missing until Task 3 — keep it, it goes green in Task 3).
- [ ] **Step 2:** Add tables + seed in migration `004_media`, Drizzle schema (reuse the existing `bytea` customType), permission entry. Run `npx tsc --noEmit` → passes.
- [ ] **Step 3:** Commit `feat(media): schema, seed and media.manage permission`.

### Task 2: Video link parser

**Files:**
- Create: `backend/src/media/video-links.ts`, `backend/src/media/video-links.spec.ts`

**Interfaces:**
- Produces: `parseVideoLink(raw: string): { provider: 'youtube'|'facebook'|'drive'; embedUrl: string; thumbnailUrl: string | null; sourceUrl: string }` — throws `BadRequestException('Paste a YouTube, Facebook or Google Drive video link.')` otherwise.

- [ ] **Step 1: Failing unit tests** in `video-links.spec.ts`:
  - `youtube.com/watch?v=dQw4w9WgXcQ&t=30s`, `https://youtu.be/dQw4w9WgXcQ?si=x`, `m.youtube.com/watch?v=dQw4w9WgXcQ`, `youtube.com/shorts/dQw4w9WgXcQ` → `embedUrl === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'`, `thumbnailUrl === 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'`.
  - `https://www.facebook.com/msp/videos/1234567890/`, `facebook.com/watch/?v=1234567890`, `https://fb.watch/abcDEF/` → provider `facebook`, `embedUrl` starts with `https://www.facebook.com/plugins/video.php?href=` and contains the URL-encoded https source, `thumbnailUrl === null`.
  - `https://drive.google.com/file/d/1AbC_dEf/view?usp=sharing` → `embedUrl === 'https://drive.google.com/file/d/1AbC_dEf/preview'`.
  - `https://vimeo.com/1`, `javascript:alert(1)`, `not a link`, `https://youtube.com/watch?v=` → throws.
- [ ] **Step 2:** Run `npx jest src/media/video-links.spec.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement with `new URL()` (prefix `https://` when no scheme); YouTube ids must match `/^[\w-]{11}$/`.
- [ ] **Step 4:** Run → PASS. Commit `feat(media): video link parser`.

### Task 3: Media service and API

**Files:**
- Create: `backend/src/media/media.service.ts`, `backend/src/media/media.controller.ts`, `backend/src/media/dto.ts`, `backend/src/media/media.module.ts`, `backend/src/media/photo-token.ts`
- Modify: `backend/src/app.module.ts`, `backend/.env.example` (document `MEDIA_BUDGET_BYTES`)
- Test: `backend/test/app.e2e-spec.ts` (new `describe('media')`)

**Interfaces:**
- Consumes: Task 1 tables, `parseVideoLink`, `sniffImage`, `JwtService` (exported by AccessModule), `uniqueViolation` not needed.
- Produces (JSON shapes used by Tasks 5–6):
  - `MediaPhoto = { full: string; small: string; origin: 'site' | 'api' }` — `site` = legacy path served by the website; `api` = path relative to the API base (`/media/photos/<itemId>/<variant>` plus `?t=<token>` in admin responses).
  - `MediaItem = { id; kind: 'photo'|'video'; photo?: MediaPhoto; video?: { provider; embedUrl; thumbnailUrl: string|null; sourceUrl } }`
  - `MediaAlbum = { id; title; category; eventDate: string|null; published: boolean; items: MediaItem[] }`
  - `photo-token.ts`: `signPhotoToken(jwt, itemId): Promise<string>` (JWT `{ media: itemId }`, 1 h) and `verifyPhotoToken(jwt, token, itemId): Promise<boolean>`.
- Routes (all under `/api`):
  - Public: `GET /media/albums` → `MediaAlbum[]` (published, ≥1 item, `sort_order` asc); `GET /media/photos/:itemId/:variant` (`variant` ∈ full|small) → image if album published, or `?t=` token valid; else 404. Skip throttling.
  - Admin `@Auth('media.manage')`: `GET /admin/media/albums` (all, tokens on photo URLs); `GET /admin/media/usage` → `{ usedBytes, budgetBytes }`; `GET /admin/media/categories` → `string[]` distinct, sorted; `POST /admin/media/albums` `{title (2–80), category (2–40), eventDate?: 'YYYY-MM-DD'}` → `MediaAlbum` (hidden, top); `PATCH /admin/media/albums/:id` `{title?, category?, eventDate?: string|null, published?}`; `POST /admin/media/albums/:id/move` `{direction}`; `DELETE /admin/media/albums/:id`; `POST /admin/media/albums/:id/photos` multipart fields `full` and `small` → `MediaItem`; `POST /admin/media/albums/:id/videos` `{url}` → `MediaItem`; `POST /admin/media/items/:id/move` `{direction}`; `DELETE /admin/media/items/:id`.

- [ ] **Step 1: Failing e2e tests** (president token from existing setup; a member without the permission):
  - `ships the 4 existing albums` (from Task 1) and photo `origin === 'site'`, `full === '/images/events/orientation/1.jpg'`.
  - `requires media.manage`: member → 403 on `GET /api/admin/media/albums`.
  - `creates a hidden album at the top and publishes it`: create → not in public list; after uploading one PNG photo (multipart `full` + `small`) and `PATCH {published:true}` → first in public list with `items[0].photo.origin === 'api'`.
  - `hides photos of hidden albums`: create hidden album + photo → `GET /api/media/photos/:id/full` 404; with token from admin listing → 200 `image/png` and `cache-control` contains `no-store`; after publish, no token → 200 and `cache-control` contains `max-age=3600`.
  - `rejects non-images and oversized files`: text file → 400; 2 MB + 1 byte → 413/400.
  - `adds video links`: YouTube link → item `video.provider === 'youtube'`; `https://vimeo.com/1` → 400.
  - `reorders and deletes`: move album up/down changes public order; move item; delete item; deleting an album cascades (its photo URL → 404).
  - `hides emptied albums publicly`: published album whose only item is deleted → absent from `GET /api/media/albums`.
  - `refuses uploads over the media budget`: with `MEDIA_BUDGET_BYTES` set in the test env to `usedBytes + 100` before the upload → 413 with message containing `Media storage is full`; `GET /admin/media/usage` returns numbers.
  - `lists categories`: includes `Event`, `Workshop`, `Contest`, `Awards`.
- [ ] **Step 2:** Run `npm run test:e2e` → new tests FAIL.
- [ ] **Step 3:** Implement module. Budget = sum of `media_blobs.bytes`; read `MEDIA_BUDGET_BYTES` per request (so the test can change it). Uploads via `FileFieldsInterceptor([{name:'full',maxCount:1},{name:'small',maxCount:1}], { limits: { fileSize: 2*1024*1024 } })`. Item and album moves use the same swap-and-renumber approach as `HierarchyService.reorder`. New album `sort_order = min - 1`.
- [ ] **Step 4:** Run full checks (tsc, eslint, `npm test`, `npm run test:e2e`) → PASS; also run e2e against Docker Postgres (`TEST_DATABASE_URL`).
- [ ] **Step 5:** Commit `feat(media): albums, photos and video API`.

### Task 4: Legacy photo import command

**Files:**
- Create: `backend/scripts/import-legacy-media.ts`
- Modify: `backend/package.json` (script `media:import-legacy`: `ts-node scripts/import-legacy-media.ts`; devDependency `sharp`), `README.md` (how to run against production)

**Interfaces:**
- Consumes: `DATABASE_URL` env (required; refuses to run without it), `mediaItems`/`mediaBlobs`, files under `../frontend/public` + `legacy_path`.
- Behaviour: for every item with `legacy_path` not null: read file, `sharp` → full (fit inside 1600, JPEG q82) and small (fit inside 600, JPEG q80), insert both blobs and set `legacy_path = null` in one transaction per item; print `Imported N photos (X MB)`; running again prints `Nothing to import`.

- [ ] **Step 1:** Implement; run against local Docker DB (`DATABASE_URL` from `backend/.env`) → `Imported 37 photos`.
- [ ] **Step 2:** Verify `GET /api/media/albums` now returns `origin === 'api'` for all 37 and the images load; run again → `Nothing to import`.
- [ ] **Step 3:** Commit `feat(media): legacy photo import command`.

### Task 5: Public Media page from the database

**Files:**
- Modify: `frontend/src/app/media/page.tsx` (server component, `fetch(API_URL + '/media/albums', { cache: 'no-store' })`), `frontend/src/components/MediaGallery.tsx` (takes `albums: MediaAlbum[]` prop), `frontend/src/lib/types.ts` (MediaPhoto/MediaItem/MediaAlbum from Task 3), `frontend/src/data/events.ts` (remove `albums`/`Album`)
- Create: `frontend/src/lib/media.ts` → `photoSrc(p: MediaPhoto, variant: 'full'|'small'): string` (prefix `API_URL` when `origin === 'api'`)

- [ ] **Step 1:** Card cover cycles through the album's photo `small` versions every 1 s (as today); album with no photos uses the first video `thumbnailUrl`, else a navy→orange placeholder; count line `N Photos · M Videos` (omit a zero part); category badge as today.
- [ ] **Step 2:** Viewer steps through all items in order; video items render `<iframe src={embedUrl} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen>` in a 16:9 box; keyboard ← → Esc kept.
- [ ] **Step 3:** Category chips (`All` + distinct categories) only when >1 category; empty state "No albums yet. Check back after our next event!"; load-failure message like the Team page.
- [ ] **Step 4:** `npm run lint`, `npx tsc --noEmit` → pass. Commit `feat(media): public page reads albums from the API`.

### Task 6: Dashboard Media section

**Files:**
- Create: `frontend/src/app/dashboard/media/page.tsx` (album list), `frontend/src/app/dashboard/media/[id]/page.tsx` (album editor), `frontend/src/components/dashboard/StorageMeter.tsx`
- Modify: `frontend/src/lib/image.ts` (add `fitJpeg(file: File, maxSide: number, quality: number): Promise<Blob>` — same decoding/errors as `squareJpeg`, no crop), `frontend/src/app/dashboard/layout.tsx` (nav item `Media`, icon `Images`, perm `media.manage`), `frontend/src/app/dashboard/page.tsx` (shortcut)

- [ ] **Step 1: List page:** StorageMeter (`usedBytes / budgetBytes`, orange at ≥80 %, red at 100 % with the full message); album rows with cover (small), title, category, Hidden/Published badge, counts, ↑↓ move, "Open"; "New album" modal (title, category input with `<datalist>` from `/admin/media/categories`, optional date) → navigates to the editor.
- [ ] **Step 2: Editor page:** edit title/category/date (Save), Publish/Hide toggle, Delete album (confirm, back to list); "Add photos" (multiple file input + drop zone): for each file sequentially → `fitJpeg(f,1600,0.82)` and `fitJpeg(f,600,0.8)` → POST multipart; progress "Uploading 3 of 12"; failed files listed with reason and a Retry button; on a 413 stop the queue and show the message; "Add video" link input (+ hint: Drive must be shared "Anyone with the link"); items grid with preview (photo small via token URL / video thumbnail or provider label), ↑↓ and remove.
- [ ] **Step 3:** Hide the nav item and show the existing "no permission" empty state for users without `media.manage`.
- [ ] **Step 4:** `npm run lint`, `npx tsc --noEmit` → pass. Commit `feat(media): dashboard media manager`.

### Task 7: End-to-end browser verification

- [ ] **Step 1:** Isolated servers (backend with `DATABASE_URL=` and `DATA_DIR=memory://`, frontend copy built in the scratchpad), Playwright: public `/media` shows the 4 albums; president creates album "Hackathon 2026"/"Hackathon", uploads 3 real photos + 1 HEIC-named non-decodable file (fails with the message, others succeed), adds a YouTube link, reorders, publishes; visitor sees it first, chips include Hackathon, viewer plays the video iframe; member without permission has no Media nav; mobile width 390 px without overflow; zero page errors.
- [ ] **Step 2:** Fix anything found, re-run until clean.

### After deploy (user, with my instructions)

1. Push; backend applies `004_media` automatically.
2. Run `npm run media:import-legacy` once with the production `DATABASE_URL`.
3. Then I delete `frontend/public/images/events/` in a follow-up change and they push again.
