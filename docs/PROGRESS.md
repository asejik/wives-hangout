# Progress

## 2026-10-09 · Phase 1 decisions (builder)
- **Years married:** a whole number (0 = less than a year), not ranges.
- **Church:** Citizens of Light Church, or Other → required church name.
- **How did you hear:** WhatsApp · Instagram/Facebook · A friend or family member · Church announcement · Flyer · Other (short text).
- **Child question:** exactly as specified, No / Yes only (no count or ages).
- **Duplicates:** one per phone and per email; "already registered" + re-send to the email on file (max once per 10 min); nothing stored shown on screen.
- **Close:** two hours after the event starts → `REGISTRATION_CLOSES_AT=2026-10-24T18:00:00+01:00` (people register at the venue). No opening time: open as soon as live checks pass.
- **Headcount:** about 100–150.
- **Alerts, digest and Sheet Viewer:** `clcchurchmedia@gmail.com` only, for now.
- **Sender:** same church Gmail + app password as The Awakening (shared ~500/day, accepted).
- **Name:** one "Full name" field.

## 2026-10-09 · M0 Setup (CONFIG)
- **Changed:**
  - Own git repo; configs copied from The Awakening (tsconfigs incl. `nodenext` for `api/`, Vitest, oxlint, `vercel.json` with `lhr1` + security headers, dev server, prerender, smoke script, clip helper)
  - Temporary theme tokens (`src/styles/theme.css`, `docs/DESIGN.md`): ivory / wine / gold, Cormorant Garamond + Figtree, self-hosted; contrast computed, all ≥ 4.5
  - Placeholder page: church logo, title, date/time/venue, "Registration opens soon"; pre-rendered
  - `api/health`, `api/status` (unconfigured → `not_open`)
  - `api/_lib/config.ts` gains a **slug guard**: production refuses a `-dev` slug; everything else requires one (one shared database)
  - Link preview `public/og.jpg` + `scripts/make-og.py`; Event JSON-LD, robots.txt, sitemap.xml
  - `.env.example`, `.env.local` (dev slug, log mode, secrets empty); fixed a copied `.gitignore` line that ignored `.env.example`
- **Checks:** typecheck, lint clean; 11 tests; build + prerender OK; `npm audit` 0; 360px and desktop screenshots, no horizontal scroll, no console errors.
- **Vercel:** project `wives-hangout` in `asejiks-projects` (same scope as The Awakening), connected to GitHub. First production deploy by the builder. **Production URL: https://wives-hangout.vercel.app** (public; Deployment Protection only covers preview URLs). Functions confirmed in `lhr1` (`x-vercel-id: …::lhr1::…`).
- **Smoke (production):** 7/7 passed: pre-rendered page with title, absolute og:image and Event JSON-LD; security headers; og.jpg; robots/sitemap; 404 for unknown paths; `/api/health`; `/api/status` = `not_open`.
- **QR tooling:** `scripts/make-qr.mjs` (level H, wine modules on ivory, church logo plate ≈12% of the code). Its libraries stay out of the app's dependencies. A dry run with a stand-in URL decoded at 2520/1500/1000/600/300/200/140px and on a blurred, rotated, darker copy.
- **Print QR:** `docs/launch/wives-hangout-qr.png` (2520px) encodes `https://wives-hangout.vercel.app/?src=qr`; version 5, 37×37 modules, logo plate 12.3%. Decoded at 2520/1500/1000/600/300/200/140px and on a blurred, rotated, darker copy. Swap the centre logo for the flyer logo in M3 (same URL, so printed flyers keep working).
- **Builder done:** `awakening-test` deleted; Supabase `wives-hangout` (London) created; Sheet "Wives Hangout – Registrations" created; `.env.local` filled.
- **Next:** M1 (migration, `/api/register`, email, Sheet mirror, load test).

## 2026-10-09 · M1 pipeline: code complete, awaiting migration + live checks (FEATURE + DATABASE)
- **Changed:**
  - `supabase/migrations/001_init.sql` (+ down): one migration merging The Awakening's 001–004 without codes. Table with UNIQUE (event, phone) and (event, email), CHECKs (years 0–80, church/heard options, "Other" needs text), RLS on, no policies; `register_attendee`, `set_email_status`, `email_retry_batch` (claims rows), `sheet_pending`, `sheet_mark_synced`, `ops_summary`, `rate_limit_hit`; EXECUTE for service_role only; `rls_auto_enable()` revoked.
  - **New: Gmail daily-limit deferral.** A "550 5.4.5" error keeps the row FAILED but sets `retry_not_before` (+60 min) without using an attempt; the retry run stops sending and defers the rest of its batch; an alert explains it.
  - `shared/registration.ts`: one zod schema (years married as a whole number 0–80; church and "how did you hear" with Other text; child question No/Yes; consent).
  - `/api/register` (rate limit 40 per network per 10 min, because of carrier NAT), `/api/email-retry`; email = copy of the details + event facts (HTML + text), re-sent to the email on file for duplicates.
  - `apps-script/Code.gs`: production slug → "Registrations" tab; a `-dev` slug → separate "Registrations (DEV)" tab. Spike alert above 60/hour; digest includes "Need to bring a child".
  - Scripts: `load-test.mjs` (refuses the production URL), `export-registrations.mjs --event`, `cleanup-dev.mjs` (dev slug hard-coded).
  - `RETRY_SECRET` generated into `.env.local` (not printed).
- **Checks:** typecheck, lint clean; **112 tests** (16 run the real migration in PGlite); build OK; `npm audit` 0.
- **Next:** builder runs 001 in Supabase → local load test (dev slug, log mode) → Sheet setup → SMTP wrong-password test → preview push + smoke.

## 2026-10-09 · M1 complete: live checks passed (FEATURE + DATABASE + BUG FIX)
- **Migration 001 applied** (builder). Grants check: every function `anon_exec=false, auth_exec=false` (incl. `rls_auto_enable`). Security Advisor: no errors, no warnings.
- **Load (dev slug, log mode):**
  - Local, cold: 30/30 created, p95 3.7s. Laptop → London Supabase is ~170ms per round trip, two per registration, plus 30 new TLS connections. Warm: p95 1.2s.
  - **Preview (lhr1): 30/30 created, p50 1.3s, p95 1.5s, max 1.7s.** Target < 3s: met.
  - **Same-phone race: one created, one duplicate** (4 runs out of 4).
- **Sheet:** builder confirmed the leading 0 survives in the "Registrations (DEV)" tab; the Sheet then switched to the production slug with `ALERT_EMAIL`, triggers installed, DEV tab deleted.
- **SMTP:** wrong password → `FAILED` (log scrubbed, no address); correct password + `/api/email-retry` → `SENT` (attempt 2). A wrong secret gets 401. The preview's retry secret works.
- **Smoke on preview:** 9/9.
- **Bug (found by the builder): broken logo in the test email.** Root cause: the test email was sent from a laptop, where `SITE_URL` was unset, so the image URL fell back to `http://localhost:3000`. Fixed: the fallback is now `EVENT.productionUrl`. Regression test added. Real registrations (on Vercel) were never affected.
- **Config incident:** the builder's Preview variables were first saved under Production. The M0 slug guard means a production redeploy would have refused (dev slug + log mode in production) rather than mixing data. Moved to Preview; production gets its own values at M5.
- **Cleanup:** 124 dev rows deleted (`cleanup-dev.mjs`); dev and production totals are both 0.
- **Checks:** 113 tests; typecheck, lint clean.
- **Next:** M2 (the form and every state, confirmation screen, /privacy, Playwright).

## 2026-10-09 · M2 + M3 (flyer arrived): form, states, privacy, flyer look (FEATURE)
- **Builder decisions:** the flyer is right. **6:00 PM at Freedom Dome** (the brief said 4PM / Freedom Place); the close moves to **2026-10-24T20:00+01:00**. Show the theme line "Marriage, Motherhood and Ministry". Fold M3 into M2. Retention: delete by **24 January 2027** (the Supabase project may be deleted sooner).
- **Flyer look** (`docs/DESIGN.md`):
  - hero = sky gradient, white logo, the flyer's title lettering, burgundy theme band, the photo of the five women, a wine facts block with "Register free"
  - form on a white card; Oswald caps, Cormorant headings, Figtree text
  - sparkle motif; signature moment = the sparkle on success
  - contrast computed, all text pairs ≥ 4.5
- **Form:** full name; years married (number keypad; "0 if less than a year"); phone; email; church (CLC / Other + name); how you heard (select defaulting to "Choose one"; Other + text); the child question verbatim (No/Yes); consent linked to /privacy; honeypot + fill time.
- **States:** all errors at once with focus on the first; slow after 8s; offline / rate-limited / server-error banners that keep the answers; draft kept across refresh (sessionStorage); closed / opens-soon panels; success screen with the submitted summary + "check your email (and spam)" + Back to home; "already registered" showing no stored details.
- **/privacy** (NDPA): what, why, who (Supabase London, Google), retention, rights, contact. Pre-rendered.
- **Assets:** `og.jpg` from the flyer top; QR regenerated in flyer colours (burgundy/magenta, white logo plate), same URL, decoded at 140–2520px + phone-photo copy; favicon; email restyled (burgundy header with white logo + title lettering).
- **Bugs found in review and fixed:**
  - a long email made the success screen wider than the phone (grid cell min-width)
  - the "Other" source field's label and its error message had the same text
  - the theme band wrapped at 360px
  - a colour seam between the sky and the photo backdrop (gradient stop)
  - the email's date wrapped
- **Process slip:** a `git add -A` swept the newly dropped flyer into a commit under its old name. Harmless (church artwork, excluded from deploys), but we now stage files by name.
- **Checks:** typecheck, lint clean; 113 unit tests; **Playwright 8/8** (happy path + back to home, all errors at once, child question, duplicate shows nothing stored, refresh keeps answers, closed/opens-soon, offline, privacy link); build OK; `npm audit` 0.
- **Preview (m2-preview):** smoke 10/10; a real browser registration took 0.9s, no console errors; dev rows cleaned (0 left).
- **Next:** builder review of the screenshots → push to main (still "opens soon" without Production env) → M4-lite hardening + M5 launch.

## 2026-10-09 · M4-lite hardening (AUDIT)
- **QR:** centre now shows the WIVES HANGOUT lettering (builder request) on a burgundy plate shaped to it (12.5% of the code); decoded at 140–2520px + phone-photo copy. Same URL.
- **Security:**
  - RLS on with no policies, and every function's EXECUTE revoked from anon/authenticated (builder's SQL output); Security Advisor clean.
  - **No secrets** in `dist/` or anywhere in git history (scanned for key patterns and for the actual `.env.local` values); only `.env.example` is tracked.
  - `npm audit` 0; CSP and security headers verified by smoke; Sheet and CSV cells formula-guarded (tests).
- **SEO (preview raw HTML):**
  - title, description, absolute canonical, `og:image?v=hash`, `og:url` all present
  - Event JSON-LD uses the real facts (2026-10-24T18:00+01:00, Freedom Dome)
  - CSS inlined; sitemap/robots generated; real 404s
- **Lighthouse (preview, mobile, 3 runs):** Performance 89 / 94 / 76 (CPU noise; LCP 2.6s, CLS ≤ 0.03); Accessibility 100. Best Practices 93 and SEO 0 are preview-only: Vercel's toolbar script is blocked by our CSP, and previews send `x-robots-tag: noindex`. Re-check on production.
- **Readiness:** `docs/ADMIN_GUIDE.md` (alerts, Sheet, deletions, closing time, rollback, backups, after-event deletion by 24 Jan 2027); CSV export verified against the live schema (`--event` required).
