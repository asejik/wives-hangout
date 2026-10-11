# Wives Hangout: Registration

Registration site for **Wives Hangout** by **Citizens of Light Church**, Ilorin.

| | |
|---|---|
| **Theme** | Marriage, Motherhood and Ministry |
| **When** | Saturday 24 October 2026, 4:00 PM |
| **Where** | M&S Luxury Hotel, Ojomu Street, Off Basin Road, Ilorin (changed 10 Oct from Freedom Dome). **Revealed only after registering** (success screen and email); not on the public page. |
| **Registration closes** | Saturday 24 October 2026, 8:00 PM (so people can register at the venue) |
| **Live site** | https://wives-hangout.vercel.app |
| **Privacy notice** | https://wives-hangout.vercel.app/privacy |
| **QR code** | [`docs/launch/wives-hangout-qr.png`](docs/launch/wives-hangout-qr.png) (opens `/?src=qr`) |

The site exists so the church can plan **headcount, seating and childcare**. It is registration only (no tickets, no raffle code). Each registration is:

1. saved in Supabase Postgres (the system of record),
2. mirrored to the church's Google Sheet within 5 minutes, and
3. emailed back to the registrant as a confirmation copy.

> **Status:** live in production since 9 October 2026. See [`docs/PROGRESS.md`](docs/PROGRESS.md) for the full log.

---

## Contents

- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Commands](#commands)
- [API](#api)
- [Data model](#data-model)
- [Google Sheet mirror](#google-sheet-mirror)
- [Confirmation emails](#confirmation-emails)
- [Security and privacy](#security-and-privacy)
- [Testing](#testing)
- [Deployment](#deployment)
- [Operations](#operations)
- [Design](#design)
- [Reusing this for another event](#reusing-this-for-another-event)
- [Further docs](#further-docs)

---

## How it works

```
 Browser (pre-rendered React page)
   │  GET  /api/status    → open | not_open | closed
   │  POST /api/register  → created | duplicate | invalid | rate_limited | error
   ▼
 Vercel Functions (London, lhr1)
   │  validate (shared zod schema) → register_attendee() in one round trip
   ├──────────────► Supabase Postgres  (registrations, rate_limits)
   │                      ▲
   │  waitUntil(email)    │ every 5 min: copy new rows, ping /api/email-retry,
   ▼                      │ 7am daily summary, alerts
 Gmail SMTP          Google Apps Script (bound to the church's Sheet)
```

- **The form** asks for full name, years married, occupation, phone (Nigerian 11-digit), email, church (Citizens of Light Church or Other + name), how they heard about the event (Other + text), whether they will need to bring a child, and consent to the privacy notice.
- **One registration per person.** Phone and email are each unique per event. A repeat attempt shows "already registered", never shows stored details, and re-sends the details to the email on file.
- **The response never waits for email.** The function replies first and sends the confirmation in the background (`waitUntil`). Failed sends are retried by the Apps Script trigger.
- **Opening and closing are enforced by the server**, so a stale tab can't register after closing.

## Tech stack

| Layer | Choice |
|---|---|
| Page | Vite, React 19, TypeScript, Tailwind CSS 4. Pre-rendered at build time, then hydrated. |
| Forms | react-hook-form + zod (one schema in `shared/`, used by page and server) |
| Icons | lucide-react |
| API | Vercel Functions in `api/` (native Node ESM, region `lhr1`) |
| Database | Supabase Postgres (RLS on, server-only access through SQL functions) |
| Sheet mirror | Google Apps Script bound to the church's Google Sheet |
| Email | Gmail SMTP via nodemailer; template built with React Email |
| Tests | Vitest (unit, with PGlite for the SQL), Playwright (end to end) |
| Lint | oxlint |

Patterns are reused from the sister project **The Awakening**.

## Project layout

```
api/                  Vercel Functions
  register.ts           POST: validate, rate-limit, save, email in background
  status.ts             GET: is registration open?
  email-retry.ts        POST (Bearer secret): re-send failed confirmations
  health.ts             GET: deployment check
  _lib/                 config guard, db calls, mailer, email template, http types
shared/               Code used by both page and server
  event.ts              every public event fact (name, date, time, options, copy); the venue is NOT here
  registration.ts       the zod schema and the stored payload shape
  phone.ts              Nigerian phone normalisation
  window.ts             open / not_open / closed logic
src/                  The page
  App.tsx, main.tsx     app shell and hydration
  entry-server.tsx      SSR entry used by the pre-render step
  components/           Hero, RegistrationForm, SuccessScreen, panels, form fields
  lib/                  submit + draft (sessionStorage) helpers
  privacy/              the /privacy page
  styles/theme.css      design tokens
emails/               Confirmation.tsx (React Email source)
apps-script/          Code.gs, the Google Sheet mirror (+ tests)
supabase/migrations/  001_init.sql, 002_occupation.sql (+ rollbacks), PGlite tests
scripts/              dev server, pre-render, smoke test, export, cleanup, load test, OG/QR images
e2e/                  Playwright specs
public/               fonts, logos, hero images, og.jpg, favicon
docs/                 PROGRESS, DESIGN, ADMIN_GUIDE, launch assets
brand/                source artwork from the church (not deployed)
```

## Getting started

Requirements: Node 24 and npm. Python 3 with Pillow only if you rebuild the link-preview image.

```bash
npm ci
cp .env.example .env.local     # then fill in the values (see below)
npm run dev:full               # http://localhost:3000, page + /api
```

- `npm run dev:full` runs `scripts/dev-server.mjs`, which serves the page and the `api/` functions with env loaded from `.env.local`. Don't use `vercel dev`.
- `npm run dev` serves the page only (the API calls will fail).
- Locally, use the **dev slug** `wives-hangout-2026-dev` and `EMAIL_MODE=log` (emails are printed to the console instead of sent).

> ⚠️ There is one Supabase project. The secret key in `.env.local` can read and write **production** rows. Any delete, cleanup or load test must filter on `event = 'wives-hangout-2026-dev'`.

### Database setup (once)

Run the migrations in order in the Supabase SQL editor: [`001_init.sql`](supabase/migrations/001_init.sql), then [`002_occupation.sql`](supabase/migrations/002_occupation.sql) (adds the occupation column, live-safe). 001 creates the `registrations` and `rate_limits` tables, enables row-level security, and adds the SQL functions the API and Apps Script call. The rollback is `001_init.down.sql` (**destructive**: export first).

## Environment variables

All variables are **server-side only**. Never put a secret in a `VITE_` variable. Set them in Vercel → Project → Settings → Environment Variables, and **redeploy after any change**.

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Supabase secret key (`sb_secret_…`), never the publishable key |
| `EVENT_SLUG` | `wives-hangout-2026` in Production, `wives-hangout-2026-dev` everywhere else |
| `SMTP_USER`, `SMTP_PASS` | Church Gmail address and app password |
| `EMAIL_MODE` | `smtp` in Production, `log` elsewhere |
| `SITE_URL` | Optional absolute URL for email images and links (auto-detected on Vercel) |
| `RETRY_SECRET` | Shared with the Apps Script that calls `/api/email-retry` |
| `REGISTRATION_OPENS_AT` | Optional ISO 8601 time **with an offset**; unset means open as soon as configured |
| `REGISTRATION_CLOSES_AT` | ISO 8601 with offset, e.g. `2026-10-24T20:00:00+01:00` |

`api/_lib/config.ts` refuses to run with a `-dev` slug or `EMAIL_MODE=log` in production, and with a production slug anywhere else. An unconfigured deployment reports `not_open` ("opens soon"), so pushing early is safe.

## Commands

| Command | What it does |
|---|---|
| `npm run dev:full` | Page + API locally on :3000, env from `.env.local` |
| `npm run dev` | Page only |
| `npm run build` | Type check, client build, SSR build, pre-render (`scripts/prerender.mjs`) |
| `npm run typecheck` | `tsc -b` across page, API, emails and e2e configs |
| `npm run lint` | oxlint |
| `npm test` | Vitest unit tests (single test: `npx vitest run <path> -t "<name>"`) |
| `npm run test:e2e` | Playwright (own server on :3200, dev slug, log mode; deletes its `source=e2e` rows) |
| `npm run email:build` | Re-render the email template after editing `emails/Confirmation.tsx` (a test fails if stale) |
| `node scripts/smoke.mjs <url>` | Check a deployed site. **Run after every deploy.** Add `VERCEL_BYPASS=…` for previews. |
| `node scripts/load-test.mjs --url <url>/api/register --n 30 --email-mode-is-log` | Burst test (dev slug only; refuses production) |
| `node --env-file=.env.local scripts/export-registrations.mjs --event wives-hangout-2026 > backup.csv` | CSV backup (read-only, formula-guarded cells) |
| `node --env-file=.env.local scripts/cleanup-dev.mjs` | Delete dev test rows (dev slug is hard-coded) |
| `python3 scripts/make-og.py "brand/wives hangout - flyer.png"` | Rebuild `public/og.jpg` |
| `QR_TOOL_DIR=<dir> node scripts/make-qr.mjs <url> <centre image> <out.png>` | Regenerate the QR code and prove it decodes (its libraries live outside the app; see the script header) |

## API

All responses are JSON with a `status` field.

### `GET /api/status`
`{ "state": "open" | "not_open" | "closed", "opensAt": string | null }`. Not cached. Tells the page which screen to show.

### `POST /api/register`
Body: the form fields from `shared/registration.ts`, plus `website` (honeypot) and `elapsed_ms` (time spent filling the form).

| HTTP | `status` | Meaning |
|---|---|---|
| 201 | `created` | Saved; confirmation email queued |
| 200 | `duplicate` | Phone or email already registered (details re-sent to the email on file). Bots get this too. |
| 400 | `invalid` | Validation failed; `fields` maps field name → message |
| 403 | `not_open` / `closed` | Outside the registration window |
| 429 | `rate_limited` | More than 40 submissions from one network in 10 minutes |
| 503 | `unavailable` | Server not configured |
| 502 | `error` | Database error (logged, scrubbed) |

### `POST /api/email-retry`
Requires `Authorization: Bearer <RETRY_SECRET>`. Re-sends up to 10 `FAILED` or stale `PENDING` confirmations per call (max 5 attempts per row). If Gmail's daily limit is hit, the rest of the batch is deferred without using an attempt.

### `GET /api/health`
`{ "ok": true }`. Exposes no configuration.

## Data model

Table `public.registrations` (see `001_init.sql` and `002_occupation.sql`):

- **Answers:** `full_name`, `years_married` (0–80), `occupation` (≤ 80; required by the form, '' for rows before migration 002), `phone` (normalised `0XXXXXXXXXX`), `email` (lower-case), `church`, `church_other`, `heard_via`, `heard_other`, `bringing_child`, `consent_at`, `source` (e.g. `qr`).
- **Bookkeeping:** `event` (slug), `created_at`, `updated_at`, `email_status` (`PENDING`, `SENT`, `FAILED`, `LOGGED`), `email_attempts`, `emailed_at`, `last_resend_at`, retry fields, `sheet_synced_at`.
- **Uniqueness:** `(event, phone)` and `(event, email)`. Simultaneous submits are safe without application locks.
- **Access:** RLS enabled with no policies; `anon` and `authenticated` have no table or function rights. Only the server's secret key can call the SQL functions (`register_attendee`, `email_retry_batch`, `sheet_pending`, `sheet_mark_synced`, `ops_summary`, `rate_limit_hit`, …).
- **Rate limiting** uses a salted SHA-256 of the client IP, so raw IPs are never stored.

## Google Sheet mirror

[`apps-script/Code.gs`](apps-script/Code.gs) is pasted into the Apps Script editor of the "Wives Hangout – Registrations" Sheet. Every 5 minutes it:

- copies new production rows into the **Registrations** tab (phone kept as text; cells formula-guarded),
- calls `/api/email-retry`,
- raises alerts (sync behind or failing, emails failing, Gmail daily limit, unusual spikes, log mode in production).

At 7am it emails a daily summary (totals, last 24 hours, how many need to bring a child, email delivery).

Setup: set Script Properties `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `EVENT_SLUG`, and optionally `RETRY_URL`, `RETRY_SECRET`, `ALERT_EMAIL`; then run `setupSheet` and `installTrigger`. With a `-dev` slug, rows go to a separate **Registrations (DEV)** tab. Full steps are in [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md).

## Confirmation emails

- Source: [`emails/Confirmation.tsx`](emails/Confirmation.tsx) (React Email, flyer palette). Run `npm run email:build` after editing; the compiled template lives in `api/_lib/email-template.ts`.
- Sent from the church Gmail via nodemailer. The Gmail account is shared with The Awakening (~500 emails/day).
- Error logs are scrubbed of addresses and secrets.

## Security and privacy

- **CSP:** scripts from `'self'` only; inline styles allowed (CSS is inlined). Plus `nosniff`, a strict referrer policy, a locked-down permissions policy and `frame-ancestors 'none'` (see `vercel.json`).
- **Bot protection:** a honeypot field and a minimum 3-second fill time. Bots get the same reply as a duplicate and nothing is saved.
- **Validation twice:** the same zod schema runs in the browser and on the server, and the database has matching `CHECK` constraints.
- **No stored details are ever shown on screen** for a duplicate; they go only to the email on file.
- **Secrets** are never in `VITE_` variables, never committed (only `.env.example` is tracked), and never printed.
- **Privacy notice** at `/privacy` (Nigeria Data Protection Act): what is collected, why, who processes it (Supabase London, Google), retention, rights and contact. All data is to be deleted by **24 January 2027**.

## Testing

- **Unit (Vitest):** 113 tests across schema, phone parsing, the registration window, config guards, the register and email-retry handlers, the mailer, the email template, the SQL migration (run against PGlite) and the Apps Script.
- **End to end (Playwright):** happy path, all errors shown at once, child question, duplicates show nothing stored, a refresh keeps answers, closed and opens-soon panels, offline, privacy link. Use `getByLabel(…, { exact: true })` in new specs.
- **Smoke (deployed):** `scripts/smoke.mjs` checks the pre-rendered HTML, SEO files, security headers and the API on a live URL without creating a registration.

## Deployment

- Vercel project `wives-hangout`. **Every push to `main` deploys to Production**; other branches deploy to Preview (behind Vercel login).
- The region is set in `vercel.json` (`lhr1`); the dashboard setting is ignored.
- Every relative import in `api/` and `shared/` must end in `.js` (native ESM on Vercel). `tsconfig.api.json` uses `nodenext` so the type check catches mistakes.
- After every deploy: `node scripts/smoke.mjs https://wives-hangout.vercel.app`.
- `og:image` URLs carry a content hash (`og.jpg?v=…`) because Facebook and WhatsApp cache previews by URL.
- **Rollback:** Vercel → Deployments → last good Production deployment → ⋯ → Promote.

## Operations

The church team's guide is [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md): reading the Sheet, the alert emails and what to do, handling deletion requests, changing the closing time, backups, rollback, and deleting all data after the event.

## Design

The look comes from the event flyer (`brand/`): sky gradient, the flyer's own burgundy theme band behind the women's heads (a crop of the flyer), magenta ribbon, the flyer's white title lettering, and a four-point sparkle motif. Type is Oswald (caps), Cormorant Garamond (headings) and Figtree (text).

- Every colour, font and size is a token in [`src/styles/theme.css`](src/styles/theme.css), documented in [`docs/DESIGN.md`](docs/DESIGN.md).
- Built for 360px first; touch targets ≥ 44px; WCAG 2.2 AA contrast; `prefers-reduced-motion` respected.
- The page is pre-rendered, so nothing in the first paint may touch `window`. The form mounts only after hydration.

## Reusing this for another event

1. Edit [`shared/event.ts`](shared/event.ts) (name, date, options, copy), the venue in [`api/_lib/venue.ts`](api/_lib/venue.ts) (server only), and the matching `CHECK`s in the migration.
2. Replace the artwork in `public/assets`, then rebuild `og.jpg` and the QR code.
3. Set a new `EVENT_SLUG` and closing time in Vercel, and point the Apps Script at it.

## Further docs

- [`CLAUDE.md`](CLAUDE.md): engineering rules for this repo
- [`KICKOFF.md`](KICKOFF.md): the original brief and milestones
- [`docs/PROGRESS.md`](docs/PROGRESS.md): build and launch log
- [`docs/DESIGN.md`](docs/DESIGN.md): design tokens
- [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md): guide for the church team

---

Built by asejik for Citizens of Light Church.
