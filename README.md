# Wives Hangout: Registration

Registration site for **Wives Hangout** by **Citizens of Light Church**, Ilorin.

- **Theme:** Marriage, Motherhood and Ministry
- **When:** Saturday 24 October 2026, 6:00 PM (registration closes 8PM that day)
- **Where:** Freedom Dome, Ilesanmi Bus Stop, Tanke, Ilorin
- **Live:** https://wives-hangout.vercel.app · **QR:** [`docs/launch/wives-hangout-qr.png`](docs/launch/wives-hangout-qr.png) (opens `/?src=qr`)

Registration only, so the church can plan headcount, seating and childcare. Details are saved in a secure database, mirrored to the church's Google Sheet, and a copy is emailed to each registrant.

> **Status:** M2 (form, result screens, privacy page) built in the flyer's look; launch prep next. See [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Tech
Vite + React 19 + TypeScript + Tailwind CSS 4 (pre-rendered) · Vercel Functions (`api/`, London) · Supabase Postgres · Google Sheet mirror (Apps Script) · Gmail SMTP. Patterns reused from The Awakening.

## Local development
```bash
npm ci
npm run dev:full      # http://localhost:3000, page + /api, env from .env.local
```
`.env.local` uses the **dev slug** (`wives-hangout-2026-dev`) and `EMAIL_MODE=log`. See `.env.example` for every variable. The Supabase key is a **production** key: only ever delete or load-test dev-slug rows.

## Commands
| Command | What it does |
|---|---|
| `npm run build` | Type check, build, pre-render |
| `npm run typecheck` / `npm run lint` / `npm test` | Checks |
| `npm run test:e2e` | Playwright browser tests (local server, dev slug, log mode; cleans up its rows) |
| `npm run email:build` | Re-render the email template after editing `emails/Confirmation.tsx` |
| `node scripts/smoke.mjs <url>` | Check a deployed site (run after every deploy) |
| `node scripts/load-test.mjs --url <url>/api/register --n 30 --email-mode-is-log` | Burst test (dev slug only; refuses production) |
| `node --env-file=.env.local scripts/export-registrations.mjs --event wives-hangout-2026 > file.csv` | CSV backup (read-only) |
| `node --env-file=.env.local scripts/cleanup-dev.mjs` | Delete test rows (dev slug hard-coded) |
| `python3 scripts/make-og.py "brand/wives hangout - flyer.png"` | Rebuild the link-preview image |

## Deployment
Vercel builds every push: `main` → Production, other branches → Preview. **Rollback:** Vercel → Deployments → last good Production deployment → ⋯ → Promote.

## Docs
[`CLAUDE.md`](CLAUDE.md) (engineering rules) · [`docs/DESIGN.md`](docs/DESIGN.md) (tokens) · [`docs/PROGRESS.md`](docs/PROGRESS.md) (log) · `docs/ADMIN_GUIDE.md` (church team, coming in M4)
