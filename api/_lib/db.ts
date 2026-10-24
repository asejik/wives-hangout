import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { MealChoice, MenuItem, Who } from '../../shared/menu.js'
import type { RegisterPayload, RegistrationDetails } from '../../shared/registration.js'

// Server-only Supabase access with the secret key. RLS is on with no policies, so this key
// (role service_role) is the only way in. Never import this from src/.
// The database is shared by production and dev: always pass the event slug from EVENT_SLUG.

const TIMEOUT_MS = 10_000

export type RegisterResult =
  | { status: 'created'; id: string }
  | { status: 'duplicate'; id: string; resend: boolean; details: RegistrationDetails }

export type EmailStatus = 'SENT' | 'FAILED' | 'LOGGED'
export type RetryRow = { id: string; details: RegistrationDetails }

class DbError extends Error {}

let client: SupabaseClient | undefined

function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY
    if (!url || !key) throw new DbError('Supabase not configured')
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }) },
    })
  }
  return client
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args)
  if (error) throw new DbError(`${fn}: ${error.message}`)
  return data as T
}

export function registerAttendee(event: string, payload: RegisterPayload) {
  return rpc<RegisterResult>('register_attendee', { p_event: event, p: payload })
}

/** Counts one attempt for `key`; true while within `max` per `windowSeconds`. */
export function rateLimitHit(key: string, max: number, windowSeconds: number) {
  return rpc<boolean>('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: windowSeconds })
}

/** deferMinutes > 0: Gmail's daily limit; retry after that without using up an attempt. */
export function setEmailStatus(id: string, status: EmailStatus, deferMinutes = 0) {
  return rpc<null>('set_email_status', { p_id: id, p_status: status, p_defer_minutes: deferMinutes })
}

export function emailRetryBatch(event: string, limit: number) {
  return rpc<RetryRow[]>('email_retry_batch', { p_event: event, p_limit: limit })
}

// Meal selection (migration 003).
export type MenuLookupResult = { status: 'not_found' } | { status: 'found'; full_name: string; choice: MealChoice | null }
export type ChooseMealResult =
  | { status: 'not_found' | 'sold_out' | 'unknown_item' | 'invalid_seat' | 'seat_taken' }
  | { status: 'created' | 'already_chosen'; full_name: string; choice: MealChoice }

export function menuStatus(event: string) {
  return rpc<MenuItem[]>('menu_status', { p_event: event })
}

export function menuLookup(event: string, who: Who) {
  return rpc<MenuLookupResult>('menu_lookup', { p_event: event, p_phone: who.phone, p_email: who.email })
}

export function chooseMeal(event: string, who: Who, item: string, seat: string) {
  return rpc<ChooseMealResult>('choose_meal', { p_event: event, p_phone: who.phone, p_email: who.email, p_item: item, p_seat: seat })
}

export type SetSeatResult =
  | { status: 'not_found' | 'no_choice' | 'invalid_seat' | 'seat_taken' }
  | { status: 'updated'; full_name: string; choice: MealChoice }

/** Add or correct the seat number on her existing choice (migration 006). */
export function setMealSeat(event: string, who: Who, seat: string) {
  return rpc<SetSeatResult>('set_meal_seat', { p_event: event, p_phone: who.phone, p_email: who.email, p_seat: seat })
}
