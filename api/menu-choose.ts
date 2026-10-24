import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { parseWho } from '../shared/menu.js'
import { checkConfig, scrub } from './_lib/config.js'
import { chooseMeal, menuStatus } from './_lib/db.js'
import { menuWindow, withinMenuRateLimit } from './_lib/menu-window.js'

// Takes one plate for her, atomically in the database (choose_meal): one meal per person, no changes,
// and the last plate can only go to one person. Replies with her choice and fresh counts.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ status: 'method_not_allowed' })
  if (!checkConfig()) return res.status(503).json({ status: 'unavailable' })
  const window = menuWindow()
  if (window !== 'open') return res.status(403).json({ status: window })

  const body = (typeof req.body === 'object' && req.body ? req.body : {}) as Record<string, unknown>
  const who = parseWho(body.who)
  const item = typeof body.item === 'string' && /^[a-z0-9-]{1,40}$/.test(body.item) ? body.item : null
  if (!who || !item) return res.status(400).json({ status: 'invalid' })
  if (!(await withinMenuRateLimit(req))) return res.status(429).json({ status: 'rate_limited' })

  const started = Date.now()
  try {
    const result = await chooseMeal(process.env.EVENT_SLUG!, who, item)
    console.log(JSON.stringify({ evt: 'menu.choose', status: result.status, item, ms: Date.now() - started }))
    const items = await menuStatus(process.env.EVENT_SLUG!).catch(() => null)
    return res.status(200).json({ ...result, items })
  } catch (err) {
    console.error(JSON.stringify({ evt: 'menu.choose_error', error: scrub((err as Error).message) }))
    return res.status(502).json({ status: 'error' })
  }
}
