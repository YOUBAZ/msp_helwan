# Season committees — design

Date: 2026-11-20 · Branch: `feature/committees` · Status: approved in conversation ("A, go ahead")

## Intent

The Committees page is hard-coded in `frontend/src/data/committees.ts` (14 committees). Committees change
from season to season, so the President (or anyone given the new permission) should manage each season's
committees from the dashboard, and visitors should see this season's committees and last season's.

## Goals

- New permission `committees.manage` — group "Committees", label "Manage each season's committees
  (Committees page)" — appears as a checkbox in Roles like the others. President has it automatically.
- Committees belong to a season (the seasons already used by the Team hierarchy).
- Dashboard page **Committees** (nav item shown with `committees.manage`):
  - season picker (all seasons, newest first; badge draft/current/archived);
  - list grouped Technical / Non-technical, each committee: name, group, icon, description, tasks (bullet
    list), move up/down within its group;
  - add, edit, delete (confirm);
  - **Copy from previous season**: shows the committees of the season just before the selected one
    (previous by number among all seasons); pick one, optionally rename, it's added to the selected season
    (all fields copied, placed last in its group).
  - Archived seasons are read-only (same rule as the hierarchy): no add/edit/delete/copy; message explains.
- Public `/committees`: shows the **current season** (status `current`, else the newest non-draft season)
  and a switch to the **previous** non-draft season. If the current season has no committees yet, the page
  opens on the previous season with a note "Season N's committees are coming soon". Draft seasons never show.
- Seed (decided: option A): today's 14 committees go into **Season 26** (archived) in their current order
  and groups. Season 27 starts empty; the President copies the ones that continue.

## Non-goals

Linking committees to people/heads (the hierarchy does that), committee photos/uploads, per-committee
pages, recruitment logic, Arabic.

## Anti-goals

- The public Committees page going blank on launch day (hence the fall-back to the previous season).
- Editing history: archived seasons stay as they were.

## Approaches

1. **`committees` table keyed by `season_id`, icon stored as a key from a fixed list (chosen).** Same
   pattern as `hierarchy_positions`; icons stay crisp lucide icons, no storage cost.
2. Committees as JSON on `seasons` — one write per edit of the whole list; awkward reorder/copy, no gain.
3. Uploaded images instead of icons — costs media budget and design consistency; not asked for.

## Design decisions

- Table `committees`: `id uuid pk`, `season_id uuid NOT NULL → seasons ON DELETE CASCADE`, `name text`
  (2–80), `track text` (`technical` | `non_technical`), `icon text` (key from the list below),
  `description text` (≤ 300), `tasks jsonb string[]` (0–12 items, each 1–80), `sort_order int`,
  `created_at`. Unique `(season_id, lower(name))` → 409 "A committee with this name already exists in
  Season N." (also on copy, so the rename step matters).
- Icon keys (lucide): `brain` BrainCircuit, `layout` Layout, `database` Database, `shield` ShieldCheck,
  `smartphone` Smartphone, `cloud` CloudCog, `lock` Lock, `zap` Zap, `users` Users, `megaphone` Megaphone,
  `trending` TrendingUp, `video` Video, `calendar` Calendar, `briefcase` Briefcase, plus `code` Code,
  `palette` Palette, `pen` PenTool, `camera` Camera, `gamepad` Gamepad2, `cpu` Cpu, `globe` Globe,
  `heart` HeartHandshake, `book` BookOpen, `star` Star. Unknown key → 400.
- API:
  - Public `GET /api/committees?season=<number>` → `{ seasons: {number,name}[] (current + previous,
    newest first), season: {number,name}, committees: Committee[] }`; without `season`, the current one
    (falling back to previous when current has none, flagged `fallback: true`). Only non-draft seasons.
  - Admin (`committees.manage`): `GET /api/admin/committees/seasons` (all seasons, for the picker — the
    existing `/admin/seasons` needs `seasons.manage`), `GET /api/admin/seasons/:id/committees`,
    `POST /api/admin/seasons/:id/committees`, `PATCH /api/admin/committees/:id`,
    `DELETE /api/admin/committees/:id`, `POST /api/admin/committees/:id/move` `{direction: up|down}`
    (within season + track), `POST /api/admin/seasons/:id/committees/copy` `{ committeeId, name? }`
    (source must belong to an earlier season).
- Frontend public page keeps today's card look (dark cards, icon, italic description, task checklist) and
  revalidates every 60 s like Events.
- `frontend/src/data/committees.ts` is deleted once the page reads the API.

## Builder's calls (from the pre-plan check)

- The migration seeds committees into Season 26 only and never creates Season 27: production may already
  have a Season 27 (season numbers are unique, so inserting one could fail the deploy). The President
  creates Season 27 under Team Hierarchy (draft is fine) and then fills its committees.
- With no editable season, the dashboard says so and links to Team Hierarchy (for people with
  `seasons.manage`) or asks them to ask the President.

## Left to the builder

Dashboard layout details (follow `components/dashboard/ui.tsx`), icon picker presentation, exact copy.
