# Media page managed from the dashboard — design

Date: 2026-11-19 · Status: awaiting approval (reviewed by a builder; open questions answered)

## Intent

Today the public **Media** page (`/media`, "Visual Legacy") shows 4 hard-coded albums with 37 photos stored as files in `frontend/public/images/events/`. Adding a photo needs a developer and a redeploy. The club wants the people the President chooses (typically the Media committee) to create, edit and delete albums — photos and videos — from the dashboard, so the gallery stays current after launch (requirements PDF: E2 "best 10–20 photos per major event plus recap videos", H3 "Media and Web committees own updates").

## Decided with the President's team

- **Permission:** a new checkbox in the RBAC catalog. The President grants it to any role, including a role created just for this permission. Holders get full create / edit / delete on albums and their contents.
- **An album has:** a name, a category (e.g. Event, Hackathon, Workshop…), photos, and videos.
- **Videos are links**, not uploads: YouTube, Facebook or Google Drive links, shown as an embedded player. (Uploading video files was rejected: a single phone video is 100–300 MB and the free database is 0.5 GB in total.)
- **Photos are stored in the existing Neon PostgreSQL database**, like profile photos already are. Chosen over Cloudinary (more room, but one more account to own and hand over) and Vercel Blob (similar room to Neon, more setup). Expected capacity: roughly 1,400 web-sized photos ≈ 6–7 busy seasons.

## Goals

1. People with the permission can create, rename, re-categorise, reorder, hide/show and delete albums, and add, reorder and remove photos and video links, without a developer.
2. The public Media page keeps today's look and behaviour (album cards that cycle through their photos every second, full-screen viewer with arrows/keyboard), now driven by the database, and also plays videos.
3. The 4 existing albums appear unchanged on day one.
4. Storage stays within the free tier for several seasons, and the team can see how much they've used.

## Non-goals (this round)

- Uploading video files.
- Moving storage to Cloudinary (kept possible later: all photo storage goes through one backend service).
- Comments, likes, downloads, per-photo captions.
- Linking albums to entries on the Events page.
- Per-album permissions (the permission covers all albums).

## Anti-goals (would be a failure even if it "works")

- The public Media page becomes noticeably slower than today.
- Any existing album or photo disappears.
- Hidden (unpublished) albums or their photos are reachable by the public through the page or the API listings.
- The page embeds arbitrary third-party pages: only recognised YouTube / Facebook / Google Drive video players may be embedded.
- Uploads that silently fail, or an album left half-uploaded with no indication.

## Constraints

- Backend runs on Vercel serverless (no persistent disk; request body limit ≈ 4.5 MB). Frontend on Vercel. Database: Neon free tier (0.5 GB total, shared with all other data).
- Existing stack and patterns: NestJS + Drizzle (`backend/src/db/schema.ts`, migrations as SQL strings in `backend/src/db/migrations.ts`, applied at startup), permission catalog in `backend/src/access/permissions.ts` guarded with `@Auth('…')`, profile photos already stored as `bytea` and served from `/api/users/:id/avatar?v=…` with long cache headers, client-side image shrinking in `frontend/src/lib/image.ts`.
- Must work and look right on phones.

## Approaches considered

| Decision | Options | Picked | Why |
| --- | --- | --- | --- |
| Videos | (1) paste a YouTube / Facebook / Drive link, embedded player · (2) upload video files | **1** | Free and unlimited, smooth playback on phones; uploads would exhaust the 0.5 GB database within a few videos. |
| Photo storage | (A) Neon database · (B) Cloudinary · (C) Vercel Blob | **A** | No new account to own or hand over; enough room for several seasons; storage isolated behind one service so B stays an easy later move. |

## Design

### Permission
- New key `media.manage`, group "Media", label "Manage the Media page (albums, photos and videos)". Not given to any default role except implicitly to President.

### Albums
- Fields: title (required), category (required, free text, the editor suggests categories already used so spellings stay consistent), optional event date, published/hidden, created/updated timestamps.
- **New albums start hidden** so photos can be uploaded before visitors see them; one click publishes or hides again.
- **Album order is manual:** editors move albums up/down in the dashboard; a new album goes to the top. The public page shows albums in that order. *(My call, from review.)* The optional event date is only displayed, never used for sorting.
- Deleting an album deletes everything in it, after a confirmation.

### Items (photos and videos) inside an album
- One ordered list per album mixing photos and videos; items can be moved up/down and removed.
- **Cover:** the first photo in the list. If an album has no photos, the first video's thumbnail when the provider offers one (YouTube), otherwise a neutral placeholder. *(My call.)*
- **Photos:** the editor accepts several files at once (JPG/PNG/WebP). Each is shrunk in the browser before upload into two versions: a **full** version (longest side ≈ 1600 px) for the viewer and a **small** version (≈ 600 px) for album cards, both JPEG. Uploads go one photo per request with visible progress ("Uploading 3 of 12") and a clear list of any that failed, which can be retried. The backend re-checks the real file type (not trusting the browser) and rejects anything over 2 MB per version. *(Sizes are my call.)*
- **Videos:** the editor takes a link. The backend recognises and normalises:
  - YouTube: `youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/shorts/…` → embed `youtube-nocookie.com/embed/<id>`, thumbnail from YouTube.
  - Facebook: video URLs (`facebook.com/…/videos/…`, `facebook.com/watch/?v=…`, `fb.watch/…`) → Facebook's video embed player.
  - Google Drive: `drive.google.com/file/d/<id>/…` → `…/preview` embed; the editor reminds that sharing must be "Anyone with the link".
  - Anything else is refused with a message listing the supported sites. Only these normalised embed URLs are ever rendered in an iframe.

### Existing albums (day one) — decided: move them into the database
So that removing a photo really removes it (e.g. if a student asks to be taken down), the 37 existing photos end up stored in the database like every new photo. In two steps, so the page is never empty:
1. **On deploy:** a migration creates the 4 current albums (same titles, categories and order, published) whose photos temporarily point at the existing files in `frontend/public/images/events/…`. The page looks exactly as today.
2. **Once, right after deploy:** the President's developer runs a provided import command against the production database. It copies those files into the database (making both the full and small versions) and switches the items over; it is safe to run twice. Then the image files are deleted from the website code in a follow-up commit, so their old direct addresses stop working. Cost ≈ 9 MB of the media budget.

### Serving photos
- Public photo URLs are by item id and size, served by the backend. Photos of hidden albums and removed photos are not served publicly; the dashboard can still load hidden albums' photos for people with the permission.
- **Caching:** a photo that was already public may keep loading from caches for **up to 1 hour** after its album is hidden or it is removed; after that it's gone for new visitors. Photos of albums that were never published are never publicly cached. *(My call, from review: instant removal isn't possible once something is public on the web; 1 hour keeps the page fast.)*

### Storage meter and limit
- The Media section of the dashboard shows photo storage used against a **~400 MB media budget** (e.g. "45 MB of 400 MB"), leaving room in the 0.5 GB database for everything else.
- **Hard limit:** from 80 % the dashboard shows a warning; at 100 % the backend refuses new photo uploads with a clear message ("Media storage is full: remove photos or move to a bigger storage plan"), and the upload flow shows it. Deleting photos frees space immediately. *(My call, from review: if the database filled completely, the whole site — members, messages, everything — would stop saving.)*

### Public Media page
- Same look as today. Album cards: cover cycling through the album's photos (small versions), category badge, title, and a count such as "12 Photos · 2 Videos".
- Full-screen viewer steps through photos and videos in album order; a video item shows its embedded player; arrows, Esc and swipe-friendly controls as today.
- If there is more than one category, a row of category filter chips ("All", "Event", "Hackathon", …) above the albums. *(My call.)*
- Empty state when no published albums exist.

### Dashboard → Media (visible to holders of `media.manage`)
- Album list: cover, title, category, published/hidden, counts, move up/down, storage meter at the top, "New album".
- Album editor: edit title / category / date, publish/hide, delete album; upload photos (file picker and drag-and-drop), add a video link, reorder and remove items, with previews.

## Left to the builder

Database table design, endpoint shapes, exact UI layout and components (following the existing dashboard style), test coverage, how the storage meter is computed, and how legacy items are represented — within the decisions above.

## Review notes

A builder read this document before approval and raised four gaps; answered as follows:
1. Manual album order vs. date order → manual order (above).
2. How fast hiding/deleting takes effect given caching → up to 1 hour for already-public photos (above).
3. Whether the 37 existing photos may stay reachable as static files after removal → **no; the team chose to move them into the database** (above).
4. Whether the media budget is a hard limit → hard limit with an 80 % warning (above).
