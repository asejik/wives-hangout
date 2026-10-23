import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { checkConfig, scrub } from './_lib/config.js'
import { menuStatus } from './_lib/db.js'
import { menuWindow } from './_lib/menu-window.js'

// The menu with live "remaining" counts. Polled every few seconds by every open /menu page, so the CDN
// may serve it for 3s: counts lag by at most a few seconds, and choosing is always checked in the database.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ status: 'method_not_allowed' })
  if (!checkConfig()) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ state: 'not_open', items: [] })
  }
  try {
    const items = await menuStatus(process.env.EVENT_SLUG!)
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3, stale-while-revalidate=5')
    return res.status(200).json({ state: menuWindow(), items })
  } catch (err) {
    console.error(JSON.stringify({ evt: 'menu.error', error: scrub((err as Error).message) }))
    res.setHeader('Cache-Control', 'no-store')
    return res.status(502).json({ status: 'error' })
  }
}
