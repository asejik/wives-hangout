import type { Registration } from '../../shared/registration'

export type SubmitResult =
  | { kind: 'created' }
  | { kind: 'duplicate' }
  | { kind: 'invalid'; fields: Record<string, string> }
  | { kind: 'offline' }
  | { kind: 'error' }
  | { kind: 'closed' | 'not_open' }
  | { kind: 'rate_limited' }

/** Sent alongside the form: a hidden honeypot and how long the form was open (server bot check). */
export type BotSignals = { website: string; elapsed_ms: number }

const TIMEOUT_MS = 25_000

/** POSTs the validated form. Never throws: every outcome maps to a screen state. */
export async function submitRegistration(values: Registration, signals: BotSignals): Promise<SubmitResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'offline' }

  let res: Response
  try {
    res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, ...signals }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return navigator.onLine === false ? { kind: 'offline' } : { kind: 'error' }
  }

  const body = await res.json().catch(() => ({}))
  if (res.status === 201 && body.status === 'created') return { kind: 'created' }
  if (res.status === 200 && body.status === 'duplicate') return { kind: 'duplicate' }
  if (res.status === 400 && body.fields) return { kind: 'invalid', fields: body.fields }
  if (res.status === 429) return { kind: 'rate_limited' }
  if (res.status === 403 && (body.status === 'closed' || body.status === 'not_open')) return { kind: body.status }
  return { kind: 'error' }
}

/** `?src=qr` from the QR code and shared links, kept short and plain. */
export function sourceTag(): string {
  const src = new URLSearchParams(window.location.search).get('src') ?? ''
  return src.replace(/[^a-z0-9-]/gi, '').slice(0, 40)
}
