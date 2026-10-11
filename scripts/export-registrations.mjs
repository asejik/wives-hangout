#!/usr/bin/env node
// Exports one event's registrations to CSV (backup, seating and childcare planning). Read-only.
// One database holds production and dev rows, so name the event explicitly:
//   node --env-file=.env.local scripts/export-registrations.mjs --event wives-hangout-2026 > wives-hangout-$(date +%F).csv
// Without --event it uses EVENT_SLUG from the env file (the dev slug locally).
// Restore: Supabase → Table Editor → registrations → Insert → "Import data from CSV".

const argEvent = process.argv.indexOf('--event')
const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env
const event = argEvent > 0 ? process.argv[argEvent + 1] : process.env.EVENT_SLUG
if (!url || !key || !event) {
  console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY (node --env-file=.env.local …) and pass --event <slug>')
  process.exit(1)
}

const COLUMNS = [
  'id', 'event', 'created_at', 'full_name', 'years_married', 'phone', 'email', 'church', 'church_other',
  'heard_via', 'heard_other', 'bringing_child', 'consent_at', 'source', 'occupation',
  'email_status', 'email_attempts', 'emailed_at', 'sheet_synced_at',
]
const headers = { apikey: key, ...(key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }) }

const rows = []
for (let from = 0; ; from += 1000) {
  const res = await fetch(
    `${url}/rest/v1/registrations?event=eq.${encodeURIComponent(event)}&select=${COLUMNS.join(',')}&order=created_at`,
    { headers: { ...headers, Range: `${from}-${from + 999}` } },
  )
  if (!res.ok) {
    console.error(`Export failed: HTTP ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  const page = await res.json()
  rows.push(...page)
  if (page.length < 1000) break
}

// Quote every cell; neutralise spreadsheet formulas (CSV injection) by prefixing = + - @ with '.
const cell = (v) => {
  if (v === null || v === undefined) return '' // unquoted empty = NULL for Supabase's CSV import
  let s = String(v)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
process.stdout.write([COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(','))].join('\n') + '\n')
console.error(`Exported ${rows.length} registration(s) for ${event}.`)
