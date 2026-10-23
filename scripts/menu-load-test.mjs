#!/usr/bin/env node
// Burst test for meal selection: N dev registrants try to take the same dish at the same moment.
// DEV SLUG ONLY (the key in .env.local is a production key): it registers fake people through the target's
// /api/register (log mode), sets the dev dish to a small stock, fires N simultaneous choices, checks that
// exactly <stock> succeed and the rest get "sold_out", then cleans up (dev rows deleted; plates put back).
// The target must run with EMAIL_MODE=log, REGISTRATION_CLOSES_AT='' and RATE_LIMIT_MAX/MENU_RATE_LIMIT_MAX=1000.
//   node --env-file=.env.local scripts/menu-load-test.mjs --url http://localhost:3000 --n 30 --stock 10

const DEV = 'wives-hangout-2026-dev'
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : null)).filter(Boolean))
const base = (args.url ?? '').replace(/\/$/, '')
const n = Number(args.n ?? 30)
const stock = Number(args.stock ?? 10)
const item = 'asun-rice'
const { SUPABASE_URL: sb, SUPABASE_SECRET_KEY: key } = process.env
if (!base || !sb || !key) {
  console.error('Usage: node --env-file=.env.local scripts/menu-load-test.mjs --url http://localhost:3000 [--n 30] [--stock 10]')
  process.exit(1)
}
if (new URL(base).host === 'wives-hangout.vercel.app') {
  console.error('Refusing to load-test production.')
  process.exit(1)
}
const rest = (path, init = {}) =>
  fetch(`${sb}/rest/v1/${path}`, { ...init, headers: { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers } })
const post = async (path, body) => {
  const t = Date.now()
  const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { http: r.status, body: await r.json().catch(() => ({})), ms: Date.now() - t }
}
const pct = (s, p) => s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]

const run = Date.now().toString(36)
const phones = Array.from({ length: n }, (_, i) => '0908' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0').slice(0, 6) + (i % 10))
console.log(`Registering ${n} dev people…`)
const regs = await Promise.all(phones.map((phone, i) => post('/api/register', {
  full_name: `MENULOAD ${run} ${i}`, years_married: '3', occupation: 'Tester', phone, email: `menuload-${run}-${i}@example.invalid`,
  church: 'Citizens of Light Church', heard_via: 'Flyer', bringing_child: 'No', consent: true, source: 'loadtest', website: '', elapsed_ms: 30_000,
})))
const ok = regs.filter((r) => r.body.status === 'created').length
console.log(`Registered: ${ok}/${n}`)

await rest(`menu_items?event=eq.${DEV}&item_id=eq.${item}`, { method: 'PATCH', body: JSON.stringify({ remaining: stock }) })
console.log(`Dev stock of ${item} set to ${stock}. ${n} people choose it at the same moment…`)
const results = await Promise.all(phones.map((phone) => post('/api/menu-choose', { who: phone, item })))
const by = results.reduce((m, r) => ((m[`${r.http} ${r.body.status}`] = (m[`${r.http} ${r.body.status}`] ?? 0) + 1), m), {})
const ms = results.map((r) => r.ms).sort((a, b) => a - b)
const [{ remaining }] = await (await rest(`menu_items?event=eq.${DEV}&item_id=eq.${item}&select=remaining`)).json()
const codes = new Set(results.filter((r) => r.body.status === 'created').map((r) => r.body.choice.code))
console.log('Outcomes:', by)
console.log(`Latency ms: p50 ${pct(ms, 50)} · p95 ${pct(ms, 95)} · max ${ms.at(-1)} · remaining now ${remaining} · unique codes ${codes.size}`)

// A second try by a winner must be refused without taking another plate.
const winner = phones[results.findIndex((r) => r.body.status === 'created')]
const again = await post('/api/menu-choose', { who: winner, item: 'fried-rice' })
console.log(`Winner tries again: ${again.body.status} (expect already_chosen)`)

const pass = (by['200 created'] ?? 0) === Math.min(stock, ok) && (by['200 sold_out'] ?? 0) === ok - Math.min(stock, ok) &&
  remaining === Math.max(0, stock - ok) && codes.size === (by['200 created'] ?? 0) && again.body.status === 'already_chosen'

// Cleanup (dev only): deleting the registrations deletes their choices and puts plates back; then restore stock.
const del = await rest(`registrations?event=eq.${DEV}&source=eq.loadtest`, { method: 'DELETE' })
const gone = (await del.json()).length
const items = await (await rest(`menu_items?event=eq.${DEV}&select=item_id,quantity`)).json()
for (const it of items) await rest(`menu_items?event=eq.${DEV}&item_id=eq.${it.item_id}`, { method: 'PATCH', body: JSON.stringify({ remaining: it.quantity }) })
console.log(`Cleanup: ${gone} dev registration(s) deleted; dev menu restored to full.`)
console.log(pass ? '\nPASS' : '\nFAIL')
process.exit(pass ? 0 : 1)
