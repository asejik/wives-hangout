import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { registrationWindow, type WindowState } from '../shared/window.js'
import { checkConfig } from './_lib/config.js'

// Tells the page which screen to show. Unconfigured (e.g. prod before launch) reads as "opens soon".
export default function handler(_req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  let state: WindowState = 'not_open'
  if (checkConfig()) {
    state = registrationWindow(new Date(), process.env.REGISTRATION_OPENS_AT, process.env.REGISTRATION_CLOSES_AT)
  }
  res.status(200).json({ state, opensAt: state === 'not_open' ? process.env.REGISTRATION_OPENS_AT || null : null })
}
