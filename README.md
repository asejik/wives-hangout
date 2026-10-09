# Wives Hangout: Registration

Registration site for **Wives Hangout** by **Citizens of Light Church**, Ilorin.

- **When:** Saturday 24 October 2026, 4PM
- **Where:** Freedom Place, Ilesanmi Bus Stop, Tanke, Ilorin
- **Live:** set after the first deploy (see `docs/PROGRESS.md`)

Registration only, so the church can plan headcount, seating and childcare. Details are saved in a secure database, mirrored to the church's Google Sheet, and a copy is emailed to each registrant.

> **Status:** M0 (placeholder "Registration opens soon"). See [`docs/PROGRESS.md`](docs/PROGRESS.md).

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
| `node scripts/smoke.mjs <url>` | Check a deployed site (run after every deploy) |
| `python3 scripts/make-og.py …` | Rebuild the link-preview image |

## Deployment
Vercel builds every push: `main` → Production, other branches → Preview. **Rollback:** Vercel → Deployments → last good Production deployment → ⋯ → Promote.

## Docs
[`CLAUDE.md`](CLAUDE.md) (engineering rules) · [`docs/DESIGN.md`](docs/DESIGN.md) (tokens) · [`docs/PROGRESS.md`](docs/PROGRESS.md) (log) · `docs/ADMIN_GUIDE.md` (church team, coming in M4)
