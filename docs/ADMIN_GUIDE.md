# Wives Hangout Registration: Admin Guide

For the Citizens of Light Church team. No technical knowledge needed, except where a section says **(builder)**.

- **Registration page:** https://wives-hangout.vercel.app (the QR code on the flyer opens it)
- **Privacy notice:** https://wives-hangout.vercel.app/privacy
- **Contact address on the site:** clcchurchmedia@gmail.com
- **Event:** Saturday 24 October 2026, 4:00 PM, M&S Luxury Hotel, Ojomu Street, Off Basin Road, Ilorin (changed 10 October; it was Freedom Dome)
- **The venue is not shown on the registration page.** People see it only after registering: on the confirmation screen and in their email.
- **Registration closes:** **Tuesday 20 October 2026, 11:59 PM** (moved forward from 24 October). After that the page shows "Registration is closed" and the server refuses any registration, including from pages left open.

---

## 1. How it works, in one minute

1. A wife fills in the form and taps **Register**.
2. She sees **"You're registered!"** with a summary of her answers **and the venue**, and a copy (with the venue) arrives by email.
3. Her details are saved in a secure database (Supabase). **Within 5 minutes** they appear as a new row in the Google Sheet **"Wives Hangout – Registrations"**.
4. Each person can register **once**, by phone number or by email. If someone tries again, the site says she's already registered and re-sends her details to the email she first used. It never shows anyone's details on screen.

## 2. The Google Sheet

- **Registrations** tab: one row per person, newest at the bottom.
- **Wives Hangout → Sync now** (in the Sheet's menu bar) copies new registrations immediately instead of waiting up to 5 minutes.
- **The Sheet is a copy.** Editing or deleting a row in the Sheet does **not** change the real database. To remove someone, see section 4.
- **Columns:** `full_name`, `years_married` (0 = less than a year), `phone` (WhatsApp), `email`, `church` (+ `church_other` when "Other"), `heard_via` (+ `heard_other`), **`bringing_child`** (Yes = will need to bring a child), `created_at`, `source` ("qr" = came from the flyer's QR code), and **`occupation`** (the last column, added 11 October; blank for anyone who registered before then).
- **Childcare planning:** Data → Create a filter, then set `bringing_child` = Yes. The daily summary email also gives the count.
- **Who can see it:** shared only with clcchurchmedia@gmail.com, as a **Viewer**. Don't change it to "Anyone with the link"; it holds phone numbers and emails. (Editors could see the database key in the script settings.)

## 3. Emails you might receive (sent to clcchurchmedia@gmail.com)

| Email subject | What it means | What to do |
|---|---|---|
| **[Wives Hangout] Daily summary: N registered** | Sent about 7am: totals, new in 24 hours, how many need to bring a child, email delivery | Nothing; it's for your information |
| **[Wives Hangout] Gmail's daily sending limit was reached** | The church Gmail (shared with The Awakening) hit its ~500 emails/day limit. Confirmations wait and are retried every hour. | Nothing, unless it lasts more than a day. People still saw "You're registered!" on screen. |
| **[Wives Hangout] N confirmation email(s) failed 5 times** | Those people saw the confirmation on screen but never got the email | Tell the builder (usually a changed Gmail password) |
| **[Wives Hangout] N confirmation emails are failing** | Emails are being retried automatically every 5 minutes | Usually fixes itself. If it continues past an hour, tell the builder. |
| **[Wives Hangout] Sheet copy is N minutes behind** / **Sheet sync is failing** | New registrations aren't reaching the Sheet | Try **Wives Hangout → Sync now**. If it fails, tell the builder. **Registration itself is still working.** |
| **[Wives Hangout] N registrations in the last hour** | More than 60 sign-ups in an hour | After an announcement, that's expected. If the names look fake, tell the builder. |
| **[Wives Hangout] Production emails are in log mode** | A settings mistake: emails aren't being sent | Tell the builder **immediately** |

Each alert repeats at most every 6 hours.

## 4. Someone asks to see or delete their details

Under the Nigeria Data Protection Act, people can ask to see, correct or delete their details. Requests arrive at **clcchurchmedia@gmail.com**.

1. **Check it's really her:** the request should come from the email address she registered with.
2. **To see her details:** find her row in the Sheet and reply with what's in it.
3. **To correct or delete:** forward the request to the builder, who changes the database. Then update or delete the row in the Sheet.
4. **Record it** in the Sheet's **Deletions** tab: date, the `id` from her row, how she asked, who did it, notes.
5. Reply to confirm it's done.

## 5. Changing when registration closes (builder)

1. Vercel → wives-hangout → Settings → Environment Variables (**Production**) → `REGISTRATION_CLOSES_AT`.
2. Set the new time **with the +01:00 offset**, e.g. `2026-10-24T22:00:00+01:00`.
3. **Deployments → the latest Production deployment → ⋯ → Redeploy.** Changes only apply after a redeploy.

**To close immediately:** set a time in the past, then redeploy. The page shows "Registration is closed".

## 6. If something goes wrong

| Problem | What to do |
|---|---|
| The page shows an error when people register | Tell the builder. Their answers stay on screen, so they can try again a minute later. |
| A new release broke something **(builder)** | Vercel → Deployments → the last good Production deployment → ⋯ → **Promote**. It's back instantly. |
| The site is down for more than 30 minutes during an announcement | **Plan B:** the builder shares a Google Form with the same questions; its answers are merged into the database afterwards. |
| Someone didn't get her email | She saw "You're registered!" on screen. Ask her to check spam, or to **register again with the same phone or email**: the site re-sends her details to the original email (at most once every 10 minutes). |

## 7. Backups (builder)

Export a CSV each evening from 20 October, and on the day (read-only):
```bash
node --env-file=.env.local scripts/export-registrations.mjs --event wives-hangout-2026 > wives-hangout-$(date +%F).csv
```
`--event wives-hangout-2026` is required: `.env.local` points at the dev slug, and the same database holds test rows.

**Restore:** Supabase → Table Editor → `registrations` → Insert → **Import data from CSV**. The Google Sheet is also a continuous second copy.

## 8. After the event (builder)

1. Registration closed by itself at 11:59 PM on 20 October.
2. Delete the Gmail **app password** if The Awakening no longer needs it (Google Account → Security → App passwords). It's shared.
3. Rotate the Supabase secret key; remove `RETRY_SECRET` from Vercel; delete the Apps Script triggers.
4. Final CSV export for the team.
5. **Delete all registration details by 24 January 2027** (the privacy notice promises this): delete the Supabase project, or run `delete from public.registrations;`, and clear the Sheet. The Supabase project may be deleted sooner to free a slot for other church projects.
