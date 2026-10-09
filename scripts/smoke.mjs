#!/usr/bin/env node
// Checks a DEPLOYED site: the things local tests can't see, like Node ESM resolution on Vercel,
// headers, generated SEO files and the pre-rendered pages. Run after every deploy:
//   node scripts/smoke.mjs https://wives-hangout.vercel.app
//   VERCEL_BYPASS=<secret> node scripts/smoke.mjs https://<preview>.vercel.app
// It never creates a registration (it only sends an empty body).

const base = (process.argv[2] ?? '').replace(/\/$/, '')
if (!base.startsWith('http')) {
  console.error('Usage: node scripts/smoke.mjs <deployed URL>')
  process.exit(1)
}
const headers = process.env.VERCEL_BYPASS ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS } : {}
let failed = 0

async function check(name, fn) {
  try {
    const detail = await fn()
    console.log(`PASS  ${name}${detail ? `  (${detail})` : ''}`)
  } catch (err) {
    failed++
    console.log(`FAIL  ${name}  ${err.message}`)
  }
}
const get = (path, init = {}) => fetch(base + path, { ...init, headers: { ...headers, ...init.headers }, redirect: 'manual' })
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

await check('home page is pre-rendered with title, og:image and Event JSON-LD', async () => {
  const r = await get('/')
  const html = await r.text()
  expect(r.status === 200, `HTTP ${r.status}`)
  expect(html.includes('<title>'), 'no <title>')
  expect(/og:image" content="https:\/\//.test(html), 'og:image missing or not absolute')
  expect(html.includes('"@type":"Event"'), 'no Event JSON-LD')
  expect(html.includes('alt="Wives Hangout"') && html.includes('Marriage, Motherhood and Ministry'), 'content not in raw HTML')
})

await check('security headers', async () => {
  const r = await get('/')
  const missing = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security'].filter(
    (h) => !r.headers.get(h),
  )
  expect(missing.length === 0, `missing: ${missing.join(', ')}`)
})

await check('/privacy loads (pre-rendered)', async () => {
  const r = await get('/privacy')
  const html = await r.text()
  expect(r.status === 200 && html.includes('Privacy notice') && html.includes('24 January 2027'), `HTTP ${r.status}`)
})

await check('og.jpg is served as an image', async () => {
  const r = await get('/og.jpg')
  expect(r.status === 200 && (r.headers.get('content-type') ?? '').startsWith('image/'), `HTTP ${r.status} ${r.headers.get('content-type')}`)
})

await check('robots.txt points to an absolute sitemap; sitemap lists /', async () => {
  const robots = await (await get('/robots.txt')).text()
  expect(/Sitemap: https:\/\//.test(robots), 'no absolute Sitemap line')
  const sitemap = await (await get('/sitemap.xml')).text()
  expect(sitemap.includes('<loc>https://'), 'sitemap has no absolute URLs')
})

await check('unknown paths return 404', async () => {
  const r = await get('/definitely-not-a-page')
  expect(r.status === 404, `HTTP ${r.status}`)
})

await check('/api/health answers', async () => {
  const r = await get('/api/health')
  expect(r.status === 200 && (await r.json()).ok === true, `HTTP ${r.status}`)
})

await check('/api/status answers', async () => {
  const r = await get('/api/status')
  const body = await r.json()
  expect(r.status === 200 && ['open', 'not_open', 'closed'].includes(body.state), `HTTP ${r.status} ${JSON.stringify(body)}`)
  return `state=${body.state}`
})

await check('/api/register runs (no crash) and rejects an empty body', async () => {
  const r = await get('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  expect(r.status !== 500 && r.status < 600, `HTTP ${r.status}: the function crashed (check the Vercel logs)`)
  expect([400, 403, 429, 503, 200].includes(r.status), `unexpected HTTP ${r.status}`)
  return `HTTP ${r.status}`
})

await check('/api/email-retry refuses without the secret', async () => {
  const r = await get('/api/email-retry', { method: 'POST' })
  expect(r.status === 401, `HTTP ${r.status}`)
})

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
