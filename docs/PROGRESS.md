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
