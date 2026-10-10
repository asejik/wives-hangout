# CLAUDE.md

Guidance for Claude Code in this repository.

## Project

Registration site for **Wives Hangout** (Citizens of Light Church, Ilorin; "Marriage, Motherhood and Ministry"; Sat 24 Oct 2026, **4:00 PM** (Pastor's update; the flyer said 6:00 PM); venue M&S Luxury Hotel, Ojomu Street, Off Basin Road, Ilorin (changed 2026-10-10 from Freedom Dome; private until registration, see below). "Powered by: Birthing the Seed" under the hero. Registration closes 8:00 PM on the day. Registration only, for headcount, seating and childcare planning: **no raffle code**. Each registration is saved in Supabase, mirrored to the church's Google Sheet, and a copy of the details is emailed to the registrant.

- Built by asejik for the church. A sister project, **The Awakening** (`~/projects/the-awakening`), is the source of the patterns here. **Read it freely, never modify it from this repo.**
- Brief and milestones: `KICKOFF.md`. Status: `docs/PROGRESS.md`. Design tokens: `docs/DESIGN.md`.

## Stack

Vite + React 19 + TypeScript + Tailwind CSS 4 (pre-rendered at build, then hydrated) · Vercel Functions in `api/` (native Node ESM, region `lhr1`) · Supabase Postgres (record) · Google Sheet mirror via Apps Script · Gmail SMTP via nodemailer · zod (one schema in `shared/`), react-hook-form, lucide-react · Vitest, Playwright, oxlint.

## Commands

- `npm run dev:full`: page + `/api` via `scripts/dev-server.mjs`, env from `.env.local` (don't use `vercel dev`)
- `npm run dev`: page only
- `npm run build`: `tsc -b`, Vite build, SSR build, `scripts/prerender.mjs`
- `npm run typecheck` · `npm run lint` · `npm test` (single test: `npx vitest run path -t "name"`)
- `npm run test:e2e`: Playwright (own server on :3200, dev slug, log mode; deletes `source=e2e` dev rows). Use `getByLabel(…, { exact: true })`.
- `npm run email:build`: re-render the email template after editing `emails/Confirmation.tsx` (a test fails if stale)
- `node scripts/smoke.mjs <deployed-url>`: **after every deploy** (`VERCEL_BYPASS=…` for previews)
- `python3 scripts/make-og.py "brand/wives hangout - flyer.png"`: rebuild `public/og.jpg`
- `bash scripts/clip.sh <file>`: copy to the Windows clipboard from WSL (UTF-8 safe). If `node` isn't on PATH: `~/.nvm/versions/node/v24.21.0/bin`.

## Rules that span several files

- **One Supabase project, isolated by `EVENT_SLUG`.** Local + Preview: `wives-hangout-2026-dev`, `EMAIL_MODE=log`. Production: `wives-hangout-2026`, `EMAIL_MODE=smtp`. `api/_lib/config.ts` refuses a `-dev` slug in production and a non-`-dev` slug elsewhere. The Sheet, counts, CSV export and alerts filter by the production slug.
- **The secret key on the laptop is a production key.** Any delete, cleanup or load test must filter `event = 'wives-hangout-2026-dev'`; say so whenever touching data.
- **ESM on Vercel:** every relative import in `api/` and `shared/` needs `.js`. `tsconfig.api.json` uses `nodenext` so typecheck catches it.
- No `@vercel/node`; request/response types live in `api/_lib/http.ts`.
- Region is set in `vercel.json` (`lhr1`); the dashboard setting doesn't apply.
- Unconfigured production → `/api/status` says `not_open`, so pushing `main` early is safe. **Vercel env changes need a redeploy.**
- **Pre-render + hydration:** nothing rendered at first paint may touch `window`; the lazy form (M2) mounts only after hydration (`useSyncExternalStore` flag), or React throws #419.
- **CSP:** scripts `'self'` only; inline styles allowed (inlined CSS).
- `og:image` is `og.jpg?v=<content hash>` (vite.config.ts) because Facebook/WhatsApp cache by URL.
- No secrets in `VITE_` variables.
- **The venue is private until registration** (Pastor's request). It lives only in `api/_lib/venue.ts` (server only) and reaches people via `/api/register`'s 201 reply (success screen) and the email. Never put it in `shared/`, `src/`, `index.html` or the JSON-LD (city only). `api/_lib/venue.test.ts` and `scripts/smoke.mjs` fail if it leaks into the page.

## Visual identity

From the flyer (`brand/`): sky gradient, burgundy theme band, magenta ribbon, the flyer's white title lettering (an image), the four-point sparkle motif. Oswald caps, Cormorant Garamond headings, Figtree text. Every colour, font and size is a token in `src/styles/theme.css` (documented in `docs/DESIGN.md`). No one-off values, no new UI/animation libraries without asking, respect `prefers-reduced-motion`, 360px first, touch targets ≥ 44px, WCAG 2.2 AA contrast. The email mirrors the palette (`emails/Confirmation.tsx`, then `npm run email:build`).

## Working rules (P07)

- **Plan → stop for approval → Implement → Verify → Report.** Baseline typecheck, lint, tests and build before changing anything.
- Same error after 2 fix attempts: stop and explain. Bug fixes: reproduce, root cause with evidence, add a test.
- Report: summary, files changed, data/config changes (with rollback), check results (real output), ACTIONS FOR ME (inline copy-paste), manual test checklist, risks; then update `docs/PROGRESS.md`.
- Checkpoint commits are fine; **ask before pushing to `main`** (it deploys production). Stage files by name, not `git add -A` (the builder drops artwork into `brand/` while we work).
- Create env files with empty values; the builder fills secrets. Never print secrets.

## Git

Production: https://wives-hangout.vercel.app (Vercel project `wives-hangout`, scope `asejiks-projects`; previews sit behind Vercel login).

This folder is its own repo (branch `main`, remote `git@github.com:asejik/wives-hangout.git`). The parent `~/projects` is a different repo: never run git against it.
