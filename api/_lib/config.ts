// Startup checks shared by the API routes. A misconfiguration fails loudly (503 + error log)
// instead of silently skipping emails or breaking every insert (P03-03, P03-07).

import { parseWindowTime } from '../../shared/window.js'

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'EVENT_SLUG', 'EMAIL_MODE'] as const

/** Returns a reason string if the server can't safely take registrations, else null. */
export function configProblem(env: NodeJS.ProcessEnv = process.env): string | null {
  const missing = REQUIRED.filter((k) => !env[k])
  if (missing.length) return `missing env: ${missing.join(', ')}`
  // Must match the DB CHECK on registrations.event, or every insert fails.
  if (!/^[a-z0-9-]{1,40}$/.test(env.EVENT_SLUG!)) return 'EVENT_SLUG must be lowercase letters, digits and dashes'
  // One database holds dev and production rows, kept apart only by slug, so a mixed-up slug would
  // put test rows in the church's Sheet (or real rows in the dev cleanup). Fail loudly instead.
  const isDevSlug = env.EVENT_SLUG!.endsWith('-dev')
  if (env.VERCEL_ENV === 'production' && isDevSlug) return 'EVENT_SLUG must not end in -dev in production'
  if (env.VERCEL_ENV !== 'production' && !isDevSlug) return 'EVENT_SLUG must end in -dev outside production'
  if (env.EMAIL_MODE !== 'smtp' && env.EMAIL_MODE !== 'log') return 'EMAIL_MODE must be smtp or log'
  // Log mode in production would silently skip every confirmation email.
  if (env.VERCEL_ENV === 'production' && env.EMAIL_MODE !== 'smtp') return 'EMAIL_MODE must be smtp in production'
  for (const k of ['REGISTRATION_OPENS_AT', 'REGISTRATION_CLOSES_AT'] as const) {
    if (parseWindowTime(env[k]) === 'invalid') return `${k} must be ISO 8601 with an offset, e.g. 2026-10-25T12:00:00+01:00`
  }
  return null
}

let reported = false

/** Logs the problem once per instance; prod before M5 (no env at all) stays quiet. */
export function checkConfig(): boolean {
  const problem = configProblem()
  const unconfigured = REQUIRED.every((k) => !process.env[k]) // expected on prod until M5
  if (problem && !reported && !unconfigured) {
    console.error(JSON.stringify({ evt: 'config.invalid', problem }))
    reported = true
  }
  return problem === null
}

/** Strips email addresses from error text before it reaches the logs (P03-06). */
export function scrub(message: string): string {
  return message.replace(/[^\s<>"'@]+@[^\s<>"'@]+/g, '[email]')
}
