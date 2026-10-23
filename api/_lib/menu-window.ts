import { createHash } from 'node:crypto'
import { EVENT } from '../../shared/event.js'
import { registrationWindow, type WindowState } from '../../shared/window.js'
import { scrub } from './config.js'
import { rateLimitHit } from './db.js'
import type { ApiRequest } from './http.js'

/** Meal selection window: opens when deployed (or MENU_OPENS_AT), closes at EVENT.menuClosesAt (or MENU_CLOSES_AT). */
export function menuWindow(now = new Date()): WindowState {
  return registrationWindow(now, process.env.MENU_OPENS_AT, process.env.MENU_CLOSES_AT || EVENT.menuClosesAt)
}

// Generous: at the venue, the whole hall may share one Wi-Fi address. Mainly stops someone
// trying thousands of phone numbers. MENU_RATE_LIMIT_MAX overrides it for load tests (dev only).
const WINDOW_SECONDS = 600
const max = () => Number(process.env.MENU_RATE_LIMIT_MAX) || 300

function clientIp(req: ApiRequest): string {
  const real = req.headers['x-real-ip']
  const forwarded = req.headers['x-forwarded-for']
  const ip = (Array.isArray(real) ? real[0] : real) ?? String(forwarded ?? '').split(',')[0]
  return ip?.trim() || req.socket?.remoteAddress || 'unknown'
}

/** Salted hash so the database never holds raw IP addresses. Fails open on limiter errors. */
export async function withinMenuRateLimit(req: ApiRequest): Promise<boolean> {
  const key = createHash('sha256').update(`${process.env.SUPABASE_SECRET_KEY}:menu:${clientIp(req)}`).digest('hex')
  try {
    return await rateLimitHit(key, max(), WINDOW_SECONDS)
  } catch (err) {
    console.error(JSON.stringify({ evt: 'menu.ratelimit_error', error: scrub((err as Error).message) }))
    return true
  }
}
