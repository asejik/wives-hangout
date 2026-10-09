// Registration open/close window. Times are ISO 8601 with an offset, e.g. 2026-10-25T12:00:00+01:00.
// Unset bounds mean "no limit". Shared by /api/status, /api/register and the tests.

export type WindowState = 'open' | 'not_open' | 'closed'

export function parseWindowTime(value: string | undefined): Date | null | 'invalid' {
  if (!value) return null
  // Require an explicit offset so "12:00" can't silently mean UTC on Vercel.
  if (!/(Z|[+-]\d\d:\d\d)$/.test(value)) return 'invalid'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? 'invalid' : d
}

export function registrationWindow(now: Date, opensAt?: string, closesAt?: string): WindowState {
  const opens = parseWindowTime(opensAt)
  const closes = parseWindowTime(closesAt)
  if (opens === 'invalid' || closes === 'invalid') throw new Error('invalid registration window time')
  if (opens && now < opens) return 'not_open'
  if (closes && now >= closes) return 'closed'
  return 'open'
}
