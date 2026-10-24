import { z } from 'zod'
import { normalizeNigerianPhone } from './phone.js'

// Meal selection (/menu). A registrant identifies herself with ONE box: the phone number OR the email
// she registered with. Used by the page (to validate as she types) and by the server.

export type Who = { phone: string; email: string }

const email = z.email()

/** "0801 234 5678" / "+2348012345678" → phone; "Name@Gmail.com" → email; anything else → null. */
export function parseWho(input: unknown): Who | null {
  if (typeof input !== 'string') return null
  const v = input.trim()
  if (v.includes('@')) {
    return v.length <= 120 && email.safeParse(v).success ? { phone: '', email: v.toLowerCase() } : null
  }
  const phone = normalizeNigerianPhone(v)
  return phone ? { phone, email: '' } : null
}

export const WHO_HINT = 'Enter the phone number or email you registered with'

export type MenuItem = { item_id: string; name: string; quantity: number; remaining: number }
/** '' for choices made before seat numbers existed (migration 006). */
export type MealChoice = { item_id: string; item_name: string; code: string; chosen_at: string; seat_no: string }

/** Seat labels: up to 6 letters/digits with at least one digit, e.g. "27", "B12" (builder, 2026-10-24).
 *  Upper-cased, spaces and dashes removed. Must match valid_seat() in 006_seat.sql. */
export function parseSeat(input: unknown): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null
  const v = String(input).toUpperCase().replace(/[\s-]/g, '')
  return /^[A-Z0-9]{1,6}$/.test(v) && /[0-9]/.test(v) ? v : null
}
