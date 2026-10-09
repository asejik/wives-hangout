import { createHash } from 'node:crypto'
import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { waitUntil } from '@vercel/functions'
import { fieldErrors, registrationSchema, toPayload } from '../shared/registration.js'
import { registrationWindow } from '../shared/window.js'
import { checkConfig, scrub } from './_lib/config.js'
import { rateLimitHit, registerAttendee } from './_lib/db.js'
import { sendConfirmation } from './_lib/send-confirmation.js'

const MIN_FILL_MS = 3_000
// Per network. Generous because Nigerian mobile networks share public IPs (carrier NAT), and a
// church announcement sends many people from one building at once.
// RATE_LIMIT_MAX overrides it for load tests and e2e (dev slug only).
const RATE_WINDOW_SECONDS = 600
const DEFAULT_RATE_LIMIT = 40
const rateLimitMax = () => Number(process.env.RATE_LIMIT_MAX) || DEFAULT_RATE_LIMIT

function clientIp(req: ApiRequest): string {
  // On Vercel these headers are set by the platform (not client-controlled).
  const real = req.headers['x-real-ip']
  const forwarded = req.headers['x-forwarded-for']
  const ip = (Array.isArray(real) ? real[0] : real) ?? String(forwarded ?? '').split(',')[0]
  return ip?.trim() || req.socket?.remoteAddress || 'unknown'
}

/** Salted hash so the database never holds raw IP addresses. */
function rateKey(req: ApiRequest): string {
  return createHash('sha256').update(`${process.env.SUPABASE_SECRET_KEY}:register:${clientIp(req)}`).digest('hex')
}

async function withinRateLimit(req: ApiRequest): Promise<boolean> {
  try {
    return await rateLimitHit(rateKey(req), rateLimitMax(), RATE_WINDOW_SECONDS)
  } catch (err) {
    // Fail open: a limiter hiccup must not block real registrations.
    console.error(JSON.stringify({ evt: 'ratelimit.error', error: scrub((err as Error).message) }))
    return true
  }
}

function looksLikeBot(body: Record<string, unknown>): boolean {
  const honeypot = typeof body.website === 'string' && body.website.trim() !== ''
  const elapsed = body.elapsed_ms
  return honeypot || typeof elapsed !== 'number' || !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ status: 'method_not_allowed' })
  if (!checkConfig()) return res.status(503).json({ status: 'unavailable' })

  // Server-enforced window: a stale page can't register after closing.
  const window = registrationWindow(new Date(), process.env.REGISTRATION_OPENS_AT, process.env.REGISTRATION_CLOSES_AT)
  if (window !== 'open') return res.status(403).json({ status: window })

  if (!(await withinRateLimit(req))) {
    console.warn(JSON.stringify({ evt: 'register.rate_limited' }))
    return res.status(429).json({ status: 'rate_limited' })
  }

  // Bots: a filled honeypot or a sub-3s submit gets the same reply as a human duplicate,
  // so nothing is saved or emailed and the bot learns nothing.
  const raw = (typeof req.body === 'object' && req.body ? req.body : {}) as Record<string, unknown>
  if (looksLikeBot(raw)) {
    console.log(JSON.stringify({ evt: 'register.bot' }))
    return res.status(200).json({ status: 'duplicate' })
  }

  // Same schema as the page; never trust the browser's validation.
  const parsed = registrationSchema.safeParse(raw)
  if (!parsed.success) return res.status(400).json({ status: 'invalid', fields: fieldErrors(parsed.error) })
  const payload = toPayload(parsed.data)

  const started = Date.now()
  try {
    const result = await registerAttendee(process.env.EVENT_SLUG!, payload)
    const ms = Date.now() - started

    if (result.status === 'created') {
      console.log(JSON.stringify({ evt: 'register.created', id: result.id, ms }))
      // Respond first; the email is never on the critical path.
      waitUntil(sendConfirmation(result.id, payload, false))
      return res.status(201).json({ status: 'created' })
    }

    // Duplicate: never reveal stored details to the browser; re-send them to the email on file.
    console.log(JSON.stringify({ evt: 'register.duplicate', id: result.id, resend: result.resend, ms }))
    if (result.resend) {
      waitUntil(sendConfirmation(result.id, result.details, true))
    }
    return res.status(200).json({ status: 'duplicate' })
  } catch (err) {
    console.error(JSON.stringify({ evt: 'register.error', ms: Date.now() - started, error: scrub((err as Error).message) }))
    return res.status(502).json({ status: 'error' })
  }
}
