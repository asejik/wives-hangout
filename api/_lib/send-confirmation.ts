import type { RegistrationDetails } from '../../shared/registration.js'
import { scrub } from './config.js'
import { setEmailStatus } from './db.js'
import { confirmationEmail } from './email.js'
import { isDailyLimitError, sendMail } from './mailer.js'

export type Outcome = 'SENT' | 'FAILED' | 'LOGGED' | 'DEFERRED'

/** Gmail's daily limit resets on a rolling 24 hours; check back hourly. */
export const DAILY_LIMIT_DEFER_MINUTES = 60

/** Sends the confirmation (or re-send) and records the outcome. Never throws. */
export async function sendConfirmation(id: string, details: RegistrationDetails, resend: boolean): Promise<Outcome> {
  const started = Date.now()
  let outcome: Outcome
  try {
    // Log mode records LOGGED so test rows never claim an email went out.
    outcome = (await sendMail(confirmationEmail(details, resend))) === 'sent' ? 'SENT' : 'LOGGED'
  } catch (err) {
    outcome = isDailyLimitError(err) ? 'DEFERRED' : 'FAILED'
    console.error(JSON.stringify({ evt: 'email.failed', id, outcome, error: scrub((err as Error).message) }))
  }
  // A resend only ever upgrades the row; a failed, deferred or logged resend leaves it as it was.
  if (!(resend && outcome !== 'SENT')) {
    await recordOutcome(id, outcome)
  }
  console.log(JSON.stringify({ evt: 'email.done', id, outcome, resend, ms: Date.now() - started }))
  return outcome
}

export async function recordOutcome(id: string, outcome: Outcome) {
  try {
    if (outcome === 'DEFERRED') await setEmailStatus(id, 'FAILED', DAILY_LIMIT_DEFER_MINUTES)
    else await setEmailStatus(id, outcome)
  } catch (err) {
    console.error(JSON.stringify({ evt: 'email.status_failed', id, error: scrub((err as Error).message) }))
  }
}
