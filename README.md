# msp_helwan

Rebuild of https://msp-helwan-university.web.app — **Next.js** frontend + **NestJS** API.

| Folder | What | Port |
| --- | --- | --- |
| `frontend/` | Next.js 15 (App Router, Tailwind v4). Pages: `/`, `/committees`, `/team`, `/media`, `/events`, `/register`, `/login`, `/dashboard` | 3001 |
| `backend/` | NestJS 11 API under `/api`: contact form, newsletter, board login (JWT), admin inbox | 4001 |

## Run locally

```bash
# API
cd backend
cp .env.example .env        # then fill JWT_SECRET and BOARD_ACCOUNTS (see below)
npm install
npm run start:dev           # http://localhost:4001/api/health

# Website (second terminal)
cd frontend
npm install
npm run dev                 # http://localhost:3001
```

Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if the API isn't at `http://localhost:4001/api`.

### Accounts, roles and permissions

Accounts are **invite-only**. The very first President comes from `BOARD_ACCOUNTS`
(used only while the database has no users):

```bash
cd backend
npm run hash-password -- "a-strong-password"
# in .env:  BOARD_ACCOUNTS=you@example.com:<hash>
```

Then, in the dashboard (`/login` → `/dashboard`):
- **Members**: invite people (name, email, roles) and send them the link. They choose a password at `/set-password/...`. Also: change roles, disable accounts, create password-reset links.
- **Roles**: the President creates roles, ticks permissions, and assigns people. Default roles: President (all permissions, protected), High Board, Board, Member.
- Rules enforced by the API: nobody can grant permissions they don't have, only a President can appoint a President, and the club always keeps at least one active President.

Add new permissions in `backend/src/access/permissions.ts` and protect routes with `@Auth('your.permission')`.

## Where to edit content

- Contact info & social links: `frontend/src/data/site.ts` (the WhatsApp number is still the original site's placeholder)
- Committees: `frontend/src/data/committees.ts`
- Board members: `frontend/src/data/team.ts` (photos in `frontend/public/images/team/`)
- Events & gallery albums: `frontend/src/data/events.ts` (photos in `frontend/public/images/events/`)

## Database

PostgreSQL via Drizzle ORM (`backend/src/db/`). Migrations live in `backend/src/db/migrations.ts` and run automatically when the backend starts.

| Where | Database | How to view the tables |
| --- | --- | --- |
| Production | Neon (`DATABASE_URL` in Vercel) | console.neon.tech → your project → **Tables** / **SQL Editor** |
| Local (recommended) | PostgreSQL in Docker | pgAdmin at http://localhost:5050 |
| Local (no Docker) | Built-in PGlite in `backend/data/pglite` (when `DATABASE_URL` is empty) | not viewable while the backend runs |

### Local PostgreSQL + pgAdmin (Docker)

```bash
docker compose up -d      # in the project root: starts PostgreSQL (port 5433) and pgAdmin (port 5050)
```

`backend/.env` then uses `DATABASE_URL=postgres://msp:msp_local_dev@localhost:5433/msp_helwan`.

In pgAdmin (http://localhost:5050): expand **Servers → MSP Helwan (local)**, enter the password `msp_local_dev` once (tick "Save password"), then open
**Databases → msp_helwan → Schemas → public → Tables**. Right-click a table → **View/Edit Data → All Rows**.

`docker compose stop` stops both (data is kept). `docker compose down -v` deletes the local database completely.

## Deploy for free (Vercel + Neon, no credit card)

Create **two Vercel projects from this same repo**:

| Project | Root Directory | Environment variables |
| --- | --- | --- |
| API | `backend` | `DATABASE_URL`, `JWT_SECRET`, `BOARD_ACCOUNTS`, `CORS_ORIGIN=https://<website>.vercel.app` |
| Website | `frontend` | `NEXT_PUBLIC_API_URL=https://<api>.vercel.app/api` |

Redeploy the website after changing `NEXT_PUBLIC_API_URL` (it is baked in at build time).

## Tests

```bash
cd backend && npm run test:e2e   # uses an in-memory database
```
