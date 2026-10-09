#!/usr/bin/env node
// Deletes TEST rows only: event = 'wives-hangout-2026-dev' (hard-coded; production rows can't match).
// The key in .env.local is a production key, so cleanup never takes the slug from the environment.
//   node --env-file=.env.local scripts/cleanup-dev.mjs [--source loadtest]   (default: all dev rows)
// SQL equivalent: delete from public.registrations where event = 'wives-hangout-2026-dev';

const DEV_SLUG = 'wives-hangout-2026-dev'
const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env
if (!url || !key) {
  console.error('Run with: node --env-file=.env.local scripts/cleanup-dev.mjs')
  process.exit(1)
}
const i = process.argv.indexOf('--source')
const source = i > 0 ? process.argv[i + 1] : null

const filter = `event=eq.${DEV_SLUG}` + (source ? `&source=eq.${encodeURIComponent(source)}` : '')
const headers = { apikey: key, Prefer: 'return=representation', ...(key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }) }
const res = await fetch(`${url}/rest/v1/registrations?${filter}&select=id,event`, { method: 'DELETE', headers })
if (!res.ok) {
  console.error(`Cleanup failed: HTTP ${res.status} ${await res.text()}`)
  process.exit(1)
}
const rows = await res.json()
if (rows.some((r) => r.event !== DEV_SLUG)) throw new Error('unexpected non-dev row in the result') // can't happen; belt and braces
console.log(`Deleted ${rows.length} dev row(s) (event=${DEV_SLUG}${source ? `, source=${source}` : ''}).`)
