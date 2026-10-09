import type { ApiRequest, ApiResponse } from './_lib/http.js'

// M0: proves Vercel Functions deploy. Exposes no configuration or secrets.
export default function handler(_req: ApiRequest, res: ApiResponse) {
  res.status(200).json({ ok: true })
}
