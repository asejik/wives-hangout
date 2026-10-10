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

## 2026-10-09 · M5 LAUNCH: production open (CONFIG)
- **Production env** (builder): 8 variables, Production only (checked by name/environment; values never printed). `RETRY_SECRET` is a fresh production value (`.env.prod-secrets`, git-ignored), also in the Sheet's Script Properties with `RETRY_URL`.
- **Note:** the earlier Preview variables were moved (not copied) to Production, so **Preview is now unconfigured** (shows "opens soon"). Re-add the Preview set before the next preview test.
- **Pushed `main` → production open:** `/api/status` = open, which proves `EVENT_SLUG` is the production slug and `EMAIL_MODE=smtp` (the guard refuses anything else in production).
- **Smoke (production): 10/10.** `/api/email-retry` with the production secret: 200. No `x-robots-tag` on production.
- **Lighthouse (production, mobile):** run 1 (cold CDN right after deploy) Perf 48; runs 2–3 **Perf 91 / 94**, **A11y 100, Best Practices 96, SEO 100**, LCP 1.9–2.2s, CLS ≤ 0.03.
- **Next:** builder's real registration on mobile data (inbox + images + Sheet row) → delete that row → Facebook "Scrape Again".

## 2026-10-09 · Launch verified (sign-off)
- **Builder's real registration on mobile data:** confirmation screen ✓, email in the inbox with images ✓, Sheet row ✓ (after the fix below), link preview ✓.
- **Sheet issue:** only the "Registrations (DEV)" tab existed, so the production row stayed unsynced. Cause: the switch to the production slug (setup step A.6: `EVENT_SLUG`, `setupSheet`, `installTrigger`) hadn't been done. Fixed by the builder; the row synced.
- **Cleanup:** the builder's test row deleted by id (production total 0 afterwards); the builder deletes it from the Sheet.
- **Status: LIVE and ready for the 11 Oct announcements.**
- **Open items:**
  - re-add the Preview env variables before the next preview test
  - confirm the first 7am daily summary arrives
  - after the event: delete all data by 24 Jan 2027 (ADMIN_GUIDE §8)

## 2026-10-09 · Pastor's update: 4:00 PM, venue revealed only after registering (FEATURE)
- **Time:** 4:00 PM everywhere (page, success screen, email, meta/OG text, Event JSON-LD `startDate` 2026-10-24T16:00+01:00). Registration close unchanged: **8:00 PM** (builder decision).
- **Venue removed from the public page:** the hero, `index.html` description/OG text, and the JSON-LD (location is now the city only: Ilorin).
- **Venue moved server-side:** `api/_lib/venue.ts`. `/api/register` returns it in the 201 reply only (never for a duplicate, so the bot "fake duplicate" reveals nothing); the success screen shows it; the email shows it. It used to be in `shared/event.ts`, which compiles into the public JavaScript, so it would have been readable in the page source.
- **Guards:** `api/_lib/venue.test.ts` (not in the shared facts or the page sources; correct time); `scripts/smoke.mjs` checks the live HTML **and its JS bundles** for the venue; e2e: no venue on the landing page, the venue shown after registering.
- **Checks:** typecheck, lint clean; **116 unit tests**; **Playwright 8/8**; build OK; venue absent from `dist/`; 360px no sideways scroll.
- **Note:** registrations made before this change got emails saying 6:00 PM (production had 1 row at the time).

## 2026-10-09 · Pastor's test registration removed
- At the builder's request, the one production row (the Pastor's test, 22:03 UTC) was deleted by id. Production total: 0. The builder removes it from the Sheet.

## 2026-10-10 · New venue, "Powered by", theme band behind the heads (FEATURE)
- **Venue:** now "M&S Luxury Hotel, Ojomu Street, Off Basin Road, Ilorin" (`api/_lib/venue.ts`, server only; still revealed only after registering). Email template rebuilt; "&" escaped correctly in the HTML.
- **Venue guards** now check distinctive words of the current and earlier venue (`Ojomu`, `Luxury Hotel`, `Basin Road`, `Freedom`) in `api/_lib/venue.test.ts` and `scripts/smoke.mjs` (page HTML + preloaded scripts), plus e2e.
- **"POWERED BY: BIRTHING THE SEED"** under the hero's Register button (`EVENT.poweredBy`; rose on wine, 7.3:1).
- **Theme band behind the women's heads, as on the flyer:** a page can't layer text behind people in a photo without a cut-out, so the hero image is now a taller crop of the flyer itself (y 1850–3990), which already has the band behind the heads and the ribbon. The HTML band is removed; the theme text is in the image's alt (smoke still finds it in the raw HTML). The photo mask's top fade is shortened (16% → 6%) so the band stays crisp. Hero images: 720w webp 39 KB, 1280w webp 83 KB.
