import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { parseSeat, parseWho } from '../shared/menu.js'
import { checkConfig, scrub } from './_lib/config.js'
import { setMealSeat } from './_lib/db.js'
import { menuWindow, withinMenuRateLimit } from './_lib/menu-window.js'

// Adds or corrects the seat number on her existing meal choice (the meal itself never changes).
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ status: 'method_not_allowed' })
  if (!checkConfig()) return res.status(503).json({ status: 'unavailable' })
  const window = menuWindow()
  if (window !== 'open') return res.status(403).json({ status: window })

  const body = (typeof req.body === 'object' && req.body ? req.body : {}) as Record<string, unknown>
  const who = parseWho(body.who)
  if (!who) return res.status(400).json({ status: 'invalid' })
  const seat = parseSeat(body.seat)
  if (!seat) return res.status(400).json({ status: 'invalid_seat' })
  if (!(await withinMenuRateLimit(req))) return res.status(429).json({ status: 'rate_limited' })
  try {
    const result = await setMealSeat(process.env.EVENT_SLUG!, who, seat)
    console.log(JSON.stringify({ evt: 'menu.seat', status: result.status, seat }))
    return res.status(200).json(result)
  } catch (err) {
    console.error(JSON.stringify({ evt: 'menu.seat_error', error: scrub((err as Error).message) }))
    return res.status(502).json({ status: 'error' })
  }
}
