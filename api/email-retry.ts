import { timingSafeEqual } from 'node:crypto'
import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { checkConfig, scrub } from './_lib/config.js'
import { emailRetryBatch } from './_lib/db.js'
import { recordOutcome, sendConfirmation, type Outcome } from './_lib/send-confirmation.js'

// Called every 5 minutes by the Apps Script trigger (Authorization: Bearer RETRY_SECRET).
// Re-sends FAILED and stale PENDING confirmations; at most 5 attempts per row (enforced in SQL).
// If Gmail's daily limit is hit, the rest of the batch is deferred without sending (no attempt used).

const BATCH = 10 // keeps a run well inside the function time limit

function authorized(header: string | undefined): boolean {
  const secret = process.env.RETRY_SECRET
  if (!secret || !header?.startsWith('Bearer ')) return false
  const given = Buffer.from(header.slice('Bearer '.length))
  const expected = Buffer.from(secret)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ status: 'method_not_allowed' })
  if (!authorized(req.headers.authorization)) return res.status(401).json({ status: 'unauthorized' })
  if (!checkConfig()) return res.status(503).json({ status: 'unavailable' })

  try {
    const rows = await emailRetryBatch(process.env.EVENT_SLUG!, BATCH)
    const outcomes: Record<Outcome, number> = { SENT: 0, FAILED: 0, LOGGED: 0, DEFERRED: 0 }
    let dailyLimitHit = false
    for (const r of rows) {
      if (dailyLimitHit) {
        await recordOutcome(r.id, 'DEFERRED')
        outcomes.DEFERRED++
        continue
      }
      const outcome = await sendConfirmation(r.id, r.details, false)
      outcomes[outcome]++
      dailyLimitHit = outcome === 'DEFERRED'
    }
    console.log(JSON.stringify({ evt: 'email_retry.done', processed: rows.length, ...outcomes }))
    return res.status(200).json({ status: 'ok', processed: rows.length, ...outcomes })
  } catch (err) {
    console.error(JSON.stringify({ evt: 'email_retry.error', error: scrub((err as Error).message) }))
    return res.status(502).json({ status: 'error' })
  }
}
