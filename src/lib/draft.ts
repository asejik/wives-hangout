import type { RegistrationInput } from '../../shared/registration'

// Keeps the answers if the page is refreshed or the browser drops the tab (sessionStorage: this tab only).
// Every access is wrapped: private mode, blocked storage or quota errors must never break the form.
const KEY = 'wives-hangout-draft-v1'
const FIELDS = [
  'full_name', 'years_married', 'phone', 'email', 'church', 'church_other', 'heard_via', 'heard_other', 'bringing_child', 'consent',
] as const

export function loadDraft(): Partial<RegistrationInput> {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const f of FIELDS) if (f in data && data[f] !== undefined && data[f] !== null) out[f] = data[f]
    return out as Partial<RegistrationInput>
  } catch {
    return {}
  }
}

export function saveDraft(values: Partial<RegistrationInput>) {
  try {
    const out: Record<string, unknown> = {}
    for (const f of FIELDS) out[f] = values[f]
    window.sessionStorage.setItem(KEY, JSON.stringify(out))
  } catch {
    /* storage unavailable: the in-memory form still works */
  }
}

export function clearDraft() {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
