#!/usr/bin/env node
// Load test for /api/register. Uses FAKE addresses, so the target MUST run with EMAIL_MODE=log,
// which also means the dev slug (wives-hangout-2026-dev): the server refuses log mode in production.
// The target must allow the burst: RATE_LIMIT_MAX=1000 (default limit is 40 per IP per 10 min).
// Usage: node scripts/load-test.mjs --url http://localhost:3000/api/register --n 30 --email-mode-is-log [--p95 3000]
//   --p95 <ms>    latency target (default 3000; 0 skips the check)
// Rows are tagged source=loadtest and full_name "LOADTEST …". Clean up (dev slug only):
//   delete from public.registrations where event = 'wives-hangout-2026-dev' and source = 'loadtest';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true] : null)).filter(Boolean),
)
const url = args.url
const n = Number(args.n ?? 30)
const p95Limit = Number(args.p95 ?? 3000)
const PRODUCTION_HOST = 'wives-hangout.vercel.app'
const bypass = process.env.VERCEL_BYPASS // optional: Vercel "Protection Bypass for Automation" secret

if (!url || args['email-mode-is-log'] !== true) {
  console.error('Usage: node scripts/load-test.mjs --url <register url> [--n 50] --email-mode-is-log')
  console.error('The flag confirms the target has EMAIL_MODE=log. Never send fake addresses through the church Gmail.')
  process.exit(1)
}
if (new URL(url).host === PRODUCTION_HOST) {
  console.error(`Refusing to load-test production (${PRODUCTION_HOST}). Use the local dev server or a preview URL.`)
  process.exit(1)
}

const run = Date.now().toString(36)
const rand = (len) => Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('')
const person = (i, phone = '090' + rand(8)) => ({
  full_name: `LOADTEST ${run} ${i}`,
  years_married: String(i % 30),
  phone,
  email: `loadtest-${run}-${i}@example.invalid`,
  church: i % 3 ? 'Citizens of Light Church' : 'Other',
  church_other: i % 3 ? '' : 'Load Test Church',
  heard_via: 'WhatsApp',
  bringing_child: i % 4 ? 'No' : 'Yes',
  consent: true,
  source: 'loadtest',
  website: '',
  elapsed_ms: 30_000, // past the 3s bot check
})

async function post(body) {
  const t = Date.now()
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (bypass) headers['x-vercel-protection-bypass'] = bypass
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const json = await r.json().catch(() => ({}))
    return { http: r.status, status: json.status, ms: Date.now() - t }
  } catch (err) {
    return { http: 0, status: 'network:' + (err.cause?.code ?? err.name), ms: Date.now() - t }
  }
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]

// Fail fast if nothing is serving the URL (e.g. `vercel dev` not ready).
try {
  await fetch(new URL('/api/health', url), { signal: AbortSignal.timeout(5000), headers: bypass ? { 'x-vercel-protection-bypass': bypass } : {} })
} catch (err) {
  console.error(`Can't reach ${new URL('/api/health', url)} (${err.cause?.code ?? err.name}). Is \`npm run dev:full\` running and showing "Ready"?`)
  process.exit(1)
}

console.log(`Run ${run}: ${n} parallel registrations → ${url}`)
const results = await Promise.all(Array.from({ length: n }, (_, i) => post(person(i))))
const ms = results.map((r) => r.ms).sort((a, b) => a - b)
const created = results.filter((r) => r.status === 'created')
const byStatus = results.reduce((m, r) => ((m[`${r.http} ${r.status}`] = (m[`${r.http} ${r.status}`] ?? 0) + 1), m), {})

console.log('Outcomes:', byStatus)
console.log(`Created: ${created.length}/${n}`)
console.log(`Latency ms: p50 ${pct(ms, 50)} · p95 ${pct(ms, 95)} · max ${ms.at(-1)}`)

console.log('\nRace: same phone submitted twice at the same moment…')
const phone = '091' + rand(8)
const race = await Promise.all([post(person('raceA', phone)), post(person('raceB', phone))])
console.log(race.map((r) => `${r.http} ${r.status}`).join(' | '), '(expect one created, one duplicate)')

const ok = created.length === n && (p95Limit === 0 || pct(ms, 95) < p95Limit) &&
  race.filter((r) => r.status === 'created').length === 1 && race.filter((r) => r.status === 'duplicate').length === 1
console.log(ok ? '\nPASS' : '\nFAIL')
process.exit(ok ? 0 : 1)
