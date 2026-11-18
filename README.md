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

### Board login accounts

```bash
cd backend
npm run hash-password -- "a-strong-password"
# put the output in .env:  BOARD_ACCOUNTS=you@example.com:<hash>   (comma-separate several)
```

Logged-in board members see contact messages and newsletter subscribers at `/dashboard`.

## Where to edit content

- Contact info & social links: `frontend/src/data/site.ts` (the WhatsApp number is still the original site's placeholder)
- Committees: `frontend/src/data/committees.ts`
- Board members: `frontend/src/data/team.ts` (photos in `frontend/public/images/team/`)
- Events & gallery albums: `frontend/src/data/events.ts` (photos in `frontend/public/images/events/`)

## Storage

- **Locally** (no `MONGODB_URI`): submissions are saved as JSON files in `backend/data/` (git-ignored).
- **In production** (`MONGODB_URI` set): submissions go to MongoDB, database `msp_helwan`, collections `messages` and `subscribers`.

## Deploy for free (Vercel + MongoDB Atlas, no credit card)

Create **two Vercel projects from this same repo**:

| Project | Root Directory | Environment variables |
| --- | --- | --- |
| API | `backend` | `MONGODB_URI`, `JWT_SECRET`, `BOARD_ACCOUNTS`, `CORS_ORIGIN=https://<website>.vercel.app` |
| Website | `frontend` | `NEXT_PUBLIC_API_URL=https://<api>.vercel.app/api` |

Redeploy the website after changing `NEXT_PUBLIC_API_URL` (it is baked in at build time).

## Tests

```bash
cd backend && npm run test:e2e
```
