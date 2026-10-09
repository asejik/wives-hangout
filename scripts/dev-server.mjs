#!/usr/bin/env node
// Local dev server: Vite frontend + /api/* Vercel-style handlers in one process.
// Replaces `vercel dev`, which was slow (2-5s per request) and didn't load .env.local here.
// Run with: npm run dev:full  (node --env-file=.env.local scripts/dev-server.mjs)
// Only a local stand-in: production still runs on Vercel Functions.

import { createServer } from 'node:http'
import { createServer as createVite } from 'vite'

const port = Number(process.env.PORT ?? 3000)
const vite = await createVite({ server: { middlewareMode: true }, appType: 'spa' })

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)
  if (!url.pathname.startsWith('/api/')) return vite.middlewares(req, res)

  const name = url.pathname.slice('/api/'.length)
  if (!/^[a-z0-9-]+$/i.test(name)) return res.writeHead(404).end()

  let mod
  try {
    mod = await vite.ssrLoadModule(`/api/${name}.ts`)
  } catch {
    return res.writeHead(404).end()
  }

  // Minimal shim of the Vercel Node request/response (api/_lib/http.ts): parsed JSON body, query, status(), json().
  const raw = await readBody(req)
  try {
    req.body = raw && (req.headers['content-type'] ?? '').includes('application/json') ? JSON.parse(raw) : raw
  } catch {
    return res.writeHead(400, { 'Content-Type': 'application/json' }).end('{"status":"invalid_json"}')
  }
  req.query = Object.fromEntries(url.searchParams)
  res.status = (code) => ((res.statusCode = code), res)
  res.json = (body) => (res.setHeader('Content-Type', 'application/json'), res.end(JSON.stringify(body)), res)

  const started = Date.now()
  try {
    await mod.default(req, res)
  } catch (err) {
    vite.ssrFixStacktrace(err)
    console.error(err)
    if (!res.headersSent) res.writeHead(500).end()
  }
  console.log(`${req.method} ${url.pathname} → ${res.statusCode} (${Date.now() - started}ms)`)
})

server.listen(port, () => {
  const missing = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'EVENT_SLUG', 'EMAIL_MODE'].filter((k) => !process.env[k])
  console.log(`Ready: http://localhost:${port}  (EMAIL_MODE=${process.env.EMAIL_MODE ?? 'unset'})`)
  if (missing.length) console.warn(`Missing env: ${missing.join(', ')}. /api/register will return 503.`)
})
