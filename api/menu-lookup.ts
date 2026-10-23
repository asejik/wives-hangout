import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { parseWho } from '../shared/menu.js'
import { checkConfig, scrub } from './_lib/config.js'
import { menuLookup } from './_lib/db.js'
import { withinMenuRateLimit } from './_lib/menu-window.js'

// Finds a registrant by the phone number or email she registered with. Returns only her name (to confirm
// it's her) and any meal she already chose: never her other details.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ status: 'method_not_allowed' })
  if (!checkConfig()) return res.status(503).json({ status: 'unavailable' })
  const body = (typeof req.body === 'object' && req.body ? req.body : {}) as Record<string, unknown>
  const who = parseWho(body.who)
  if (!who) return res.status(400).json({ status: 'invalid' })
  if (!(await withinMenuRateLimit(req))) return res.status(429).json({ status: 'rate_limited' })
  try {
    const result = await menuLookup(process.env.EVENT_SLUG!, who)
    console.log(JSON.stringify({ evt: 'menu.lookup', status: result.status, by: who.phone ? 'phone' : 'email' }))
    return res.status(200).json(result)
  } catch (err) {
    console.error(JSON.stringify({ evt: 'menu.lookup_error', error: scrub((err as Error).message) }))
    return res.status(502).json({ status: 'error' })
  }
}
