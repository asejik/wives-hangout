# Kickoff: "Wives Hangout" registration site (Citizens of Light Church)

You are my senior full-stack engineer and product partner. I'm a solo builder who directs AI coding tools. We must move FAST, but safely. A sister project, **The Awakening** registration site, was built and launched in a previous session at `~/projects/the-awakening` (repo: github.com/asejik/the-awakening, live: https://the-awakening-rho.vercel.app). **Reuse its code, patterns and lessons aggressively.** Read its `README.md`, `CLAUDE.md`, `docs/DESIGN.md`, `docs/PROJECT_PLAN.md` (Revision 2) and `docs/PROGRESS.md` before planning. **Never modify that repo from this session.**

## 1. The project
- **Event:** WIVES HANGOUT, by Citizens of Light Church, Ilorin
- **When:** Saturday 24 October 2026, 4PM (WAT, +01:00)
- **Where:** Freedom Place, Ilesanmi Bus Stop, Tanke, Ilorin
- **Purpose:** registration only, so the church can plan (headcount, seating, childcare). **No raffle code.**
- **Saved to:** a Google Sheet (church Google account). **A copy of the registration details is emailed to each registrant.**
- **Repo:** https://github.com/asejik/wives-hangout. Local folder: `~/projects/wives-hangout` (empty except this file). Run `git init` here: the parent `~/projects` is a different repo, so never run git against it. This folder gets its own Vercel project and link.
- **QR code:** a branded registration QR (flyer logo in the centre) goes on the flyer. **The production URL is needed early for it**, so create the Vercel project and deploy a placeholder in M0 to lock the URL. Generate the QR as soon as the URL exists, even before the page is finished.
- **Flyer and colours:** the flyer ISN'T ready. Start with a tasteful temporary theme (warm and elegant, suited to a married women's fellowship), with **every colour, font and size as tokens** in one theme file (Tailwind 4 `@theme`). When I send the flyer, re-theme from it (M3).
- **Timeline:** today is about 9 Oct 2026. **Church announcements start Sunday 11 Oct**, so the page must be **live and working by the morning of Oct 11**. The theme can be updated after launch when the flyer arrives. The event is Oct 24. Fallback if we slip: a styled Google Form for Oct 11, switched over later.
- **Budget:** ₦0 (free tiers only). Church owns all accounts; I have delegated access.

### Form fields (my spec)
1. Name
2. How many years married?
3. Phone number (Nigerian; WhatsApp)
4. Email
5. Church
6. How did you hear about the Wives Hangout?
7. "This event is designed for wives to attend without children. Will you need to bring a child due to childcare limitations?" ☐ No ☐ Yes

Plus, as in The Awakening:
- a **consent** checkbox, linked to a `/privacy` notice (NDPA 2023)
- a hidden **honeypot** field
- the form's elapsed time, for the bot check

## 2. How we work (condensed workflow; follow it)
- **Every task:**
  - **PLAN → STOP for my approval → IMPLEMENT → VERIFY → REPORT**
  - Before changing anything, run type check, lint, tests and build, and report the baseline.
  - If the same error survives 2 fix attempts, stop and explain what you've learned.
  - For bug fixes, reproduce first, explain the root cause with evidence, and add a test.
- **Report format:**
  1. Summary
  2. Files changed
  3. Data/config changes (with rollback)
  4. Check results (real output)
  5. **ACTIONS FOR ME**
  6. Manual test checklist
  7. Risks
  8. Update `docs/PROGRESS.md`
- **My preferences:**
  - You may **make git checkpoint commits yourself** (end messages with the Co-Authored-By line you're given).
  - **Ask before pushing to `main`** (it deploys production) unless I've just approved it.
  - You may **create env files with empty values**; I fill in the secrets. Never print or paste secrets.
  - **Anything I must do (SQL, commands, dashboard clicks, env vars) goes INLINE in the chat** as copy-paste blocks, never "see doc X".
  - Explain in plain language; I'm not reading code.
  - Small project, so keep the docs lean: `README.md`, `CLAUDE.md`, `docs/PROGRESS.md`, `docs/DESIGN.md` (short) and `docs/ADMIN_GUIDE.md`.
- **UI rules:**
  - Mobile-first at 360px; touch targets ≥ 44px; WCAG 2.2 AA contrast (check it); visible focus.
  - `prefers-reduced-motion` respected; at most one signature moment; no generic AI look.
  - Tokens only, no one-off values. No new UI or animation libraries without asking.
  - Build a key screen, screenshot it at 360px and desktop (Playwright), critique it yourself, then show me.

## 3. Phase 1: clarify (ask me these in ONE round, then STOP)
Propose a default for each, and mark which need the church.
1. **"Years married":** a number, or ranges (<1, 1–5, 6–10, 11–20, 20+)? Suggest ranges.
2. **"Church":** free text, or "Citizens of Light Church" + "Other (name)"? Suggest the latter.
3. **"How did you hear":** options? Suggest WhatsApp, Instagram/Facebook, a friend or family member, a church announcement, flyer, Other.
4. **Child question = Yes:** should we also ask how many and what ages, for childcare planning? Is this a scope change for the church to decide?
5. **Duplicates:** one registration per phone and per email? On a repeat, show "already registered" and **re-send the confirmation to the email on file**. Never reveal stored details on screen.
6. **Registration close time** (suggest **Fri 23 Oct, 23:59 WAT**) and an expected headcount.
7. **Who receives alerts and a daily summary** (suggest `clcchurchmedia@gmail.com`), and who sees the Sheet (as **Viewers**).
8. **Sender:** the same church Gmail plus app password as The Awakening (they share Gmail's ~500 emails/day; I've accepted that).

## 4. Architecture: recommended default (justify any change)
Same shape as The Awakening, simplified (no codes):
- **Frontend:** Vite + React 19 + TypeScript + Tailwind CSS 4; react-hook-form + **one zod schema in `shared/`** used by both page and server; lucide-react. **Build-time pre-render plus hydration** (copy `src/entry-server.tsx`, `scripts/prerender.mjs`, the lazy form after hydration, and self-hosted fonts).
- **Backend:** Vercel Functions in `api/` (native Node ESM), region **`lhr1`** in `vercel.json`. Endpoints:
  - `POST /api/register`
  - `GET /api/status` (open / not_open / closed)
  - `POST /api/email-retry` (Bearer secret)
  - `GET /api/health`
- **Data:** **Supabase Postgres as the record, with the Google Sheet as a 5-minute pull mirror** via an Apps Script trigger plus a "Sync now" menu. Copy `apps-script/Code.gs` and simplify it.
  - **ONE Supabase project, ONE Google Sheet** (my decision). Supabase Free allows 2 active projects. I'm deleting The Awakening's TEST project (`awakening-test`) and its TEST Sheet to free a slot, then creating **`wives-hangout`** (region: London).
  - **There is no separate TEST environment.** Instead, isolate test data by **event slug** in the same database:
    - every table has an `event` column
    - **local and Preview** use `EVENT_SLUG=wives-hangout-2026-dev` with `EMAIL_MODE=log`
    - **Production** uses `EVENT_SLUG=wives-hangout-2026` with `EMAIL_MODE=smtp`
    - the Sheet mirror, `ops_summary`, CSV export and alerts all filter by the production slug, so dev rows never reach the Sheet or the counts
    - cleanup: delete rows `where event = 'wives-hangout-2026-dev'`
    - **The secret key on my laptop is therefore a production key:** never run load tests or deletes without the dev-slug filter, and say so whenever you touch data.
  - **Why not write straight to the Sheet?** In The Awakening, Apps Script plus a Sheet lock managed one registration every 1–3s, and timed out at 10 simultaneous sign-ups. A church announcement creates exactly that burst (many people at once). Only choose Sheet-direct if you can show it handles 30 at once in a load test.
- **Email:** Gmail SMTP (nodemailer, app password), sent **after** responding (`waitUntil`), with status SENT/FAILED/LOGGED, retried every 5 minutes, up to 5 attempts. `EMAIL_MODE=log` in dev and preview; **production refuses log mode**. The template is a **copy of the registration details** (HTML-escaped) plus event info, a plain-text version and a privacy footer.

## 5. Milestones (compressed for an Oct 11 launch; riskiest first)
- **M0, today (S):**
  - scaffold by copying configs and patterns from The Awakening; temporary theme tokens; placeholder "Registration opens soon" page
  - `api/health`, `api/status`; `git init`, push to GitHub; Vercel project linked
  - **deploy to get the production URL → generate the branded QR right away** (temporary centre logo: the church logo; swap in the flyer logo later)
  - `.env.example` and `.env.local`
- **M1 (S–M):**
  - Supabase migration (table with UNIQUE (event, phone) and (event, email), CHECKs, RLS on, functions with EXECUTE for service_role only, **revoke on `rls_auto_enable()`**)
  - `/api/register` with the shared schema, window check, rate limit, honeypot and timing
  - email after the response, status, retry; Sheet mirror plus alerts plus daily digest
  - **load test (dev slug, log mode):** 30 at once all saved, p95 < 3s, a same-phone race gives one row; leading 0 intact in the Sheet (use a test Sheet tab, or temporarily point the Sheet at the dev slug, then switch back)
  - wrong SMTP password gives FAILED, then SENT after a retry
  - **push a preview branch and run the smoke check against it**
- **M2 (M):**
  - the form and every state (field errors shown together, offline, slow, server error, duplicate, closed/opens-soon)
  - draft kept across refresh
  - confirmation screen: "You're registered!" plus a summary of what they just submitted, "Back to home", and "check your email (and spam)"
  - `/privacy`; Playwright smoke tests (happy path, duplicate, child question, closed, privacy link, refresh keeps answers)
- **M4-lite, hardening plus audit (one pass, before launch):**
  - **Security:** RLS on, no policies; function EXECUTE revoked; Security Advisor clean; no secrets in the bundle or git history; `npm audit` 0; CSP and security headers; formula-guarded Sheet and CSV cells.
  - **SEO and previews:** pre-rendered HTML; title, description, canonical and OG in the raw HTML; Event JSON-LD (real facts only); generated `sitemap.xml` and `robots.txt`; real 404s; content-hashed `og.jpg?v=`.
  - **Readiness:** alerts and digest working; CSV export script; short admin guide; rollback written down.
- **M5, launch by Oct 11 morning:**
  - Production env vars, then **redeploy**; LIVE Sheet properties and triggers; leads as Viewers
  - `scripts/smoke.mjs` on production; one real registration from my phone on mobile data (email in the inbox, with images)
  - Facebook Sharing Debugger **Scrape Again**; delete my test row
- **M3, flyer theme (whenever the flyer arrives, after launch):**
  - extract palette, type and motifs; propose the direction in one shot; re-theme via tokens only; check contrast
  - regenerate `og.jpg` (new hash URL) and the QR centre logo; restyle the email
  - screenshots for my sign-off; smoke check after deploy

## 6. Lessons from The Awakening (don't relearn these)
1. **Native ESM on Vercel:** every relative import in `api/` and `shared/` needs `.js`. Use `nodenext` in the api tsconfig so typecheck fails otherwise. A missing extension **crashed production** while every local test passed. Always run `scripts/smoke.mjs` against deployed URLs.
2. Don't depend on `@vercel/node` (it pulls in 11 vulnerable dev packages). Declare `ApiRequest`/`ApiResponse` in `api/_lib/http.ts`.
3. `vercel dev` was slow and ignored `.env.local`. Use the custom `scripts/dev-server.mjs` (Vite middleware plus a handler shim) via `npm run dev:full`.
4. Set the region in `vercel.json` (`"regions": ["lhr1"]`); the dashboard setting didn't apply. Supabase region: London.
5. **Google Sheets coerces values:** write phone with a leading `'`, or `080…` becomes `80…`. Formula-guard `= + - @`. Append new Sheet columns at the **end**; make `setupSheet` accept appended headers.
6. **Uniqueness belongs in Postgres** (unique constraints plus one RPC that checks, inserts and handles `unique_violation`). No app-level locks.
7. **Never reveal stored data for a duplicate.** Re-send only to the email on file, throttled to once per 10 minutes, atomically in SQL.
8. **The email is never on the critical path:** respond first, then `waitUntil` the send, a status column, a retry endpoint pinged by Apps Script, and claimed rows (`FOR UPDATE SKIP LOCKED`) so overlapping runs can't double-send. Scrub email addresses from logged errors. Set nodemailer timeouts (10s/10s/20s).
9. **React Email + Tailwind:** `sm:`/`md:` variants get inlined **unconditionally** (a bug), so use fluid layouts only. **Don't use `<Font>`**: it sets `* { font-family }`; use plain `@font-face`. Pre-render the template at build time (`npm run email:build`) with `{{PLACEHOLDERS}}`, escape values, throw on any unfilled placeholder, and add a "template is stale" test.
10. **Native `<select>` with an undefined default** silently shows the first option. Default it to `''`, so the disabled placeholder shows.
11. **zod `superRefine`** is skipped when other fields fail. Pass `{ when: () => true }`, so cross-field errors (e.g. "Yes → details required") show at the same time.
12. **Pre-render plus a lazy form:** mount the lazy form only after hydration (`useSyncExternalStore` flag), or React logs error #419. Inline the CSS in pre-rendered HTML; self-host fonts; preload the hero image. Lighthouse went from 67 to 93.
13. **Facebook/WhatsApp cache preview images by URL:** always use `og.jpg?v=<content-hash>` from the build. Share fresh links (`?src=whatsapp`) after changes.
14. **Bots and scripts:** any POSTing script or test must send `website:''` and `elapsed_ms ≥ 3000`. The load test needs `RATE_LIMIT_MAX=1000` on the target and **log mode only** (fake addresses).
15. **Supabase hosted defaults:** check grants with SQL plus the Security Advisor; revoke `rls_auto_enable()` EXECUTE in a migration (idempotent DO block). "RLS enabled, no policy" INFO is intended.
16. **Vercel env changes need a redeploy.** Production unconfigured → `/api/status` says `not_open` ("Opens soon"), which makes early pushes safe.
17. **PGlite** lets you unit-test real migrations (up and down) in Vitest. One shared instance, reset schema per test, `beforeAll` timeout of 60s.
18. **Playwright `getByLabel`** matches substrings. Use `{ exact: true }`.
19. **WSL:** paste long SQL or scripts via `bash scripts/clip.sh <file>` (PowerShell `Set-Clipboard`, UTF-8 safe; not raw `clip.exe`). If `node` isn't on PATH, use `~/.nvm/versions/node/v24.21.0/bin`.
20. Lighthouse runs from WSL created stray `C:\Users\…\lighthouse.*` folders in the repo root. Clean them up.
21. Live-safe migrations: add columns with defaults; apply them **before** pushing code that depends on them.
22. **QR codes:** use error correction H; a centre logo on a plate covering ≤ ~12% of the area; solid (touching) modules; verify decoding at 140–2520px plus a blurred, rotated copy (e.g. `qrcode` + `jsqr` npm in a scratch folder).

## 7. Start now
Read The Awakening docs above, then reply with **Phase 1 only**:
- a one-paragraph restatement
- what you'll reuse from The Awakening (file list)
- the architecture you'll use (single project plus dev slug)
- the §3 questions with proposed defaults
- the M0 plan in P07 format

Then STOP and wait for my answers.
