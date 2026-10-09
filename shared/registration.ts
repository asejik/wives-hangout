import { z } from 'zod'
import { CHURCHES, HEARD_VIA, MAX_YEARS_MARRIED, YES_NO } from './event.js'
import { normalizeNigerianPhone } from './phone.js'

// One schema for the page (react-hook-form) and the server (/api/register).
// The page POSTs exactly these values; the server parses them again and calls toPayload().

export const registrationSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Enter your full name').max(80, 'Keep it under 80 characters'),
    // A text field with a number keypad (inputMode="numeric"), so it arrives as a string.
    years_married: z
      .string()
      .trim()
      .min(1, "Enter how many years you've been married")
      .regex(/^\d{1,2}$/, 'Enter a number, e.g. 5')
      .refine((v) => Number(v) <= MAX_YEARS_MARRIED, `Enter a number from 0 to ${MAX_YEARS_MARRIED}`),
    phone: z
      .string()
      .trim()
      .refine((v) => normalizeNigerianPhone(v) !== null, 'Enter an 11-digit number, e.g. 08012345678'),
    email: z.string().trim().max(120, 'Keep it under 120 characters').pipe(z.email('Enter a valid email, e.g. name@gmail.com')),
    church: z.enum(CHURCHES, { error: 'Choose your church' }),
    church_other: z.string().trim().max(80, 'Keep it under 80 characters').default(''),
    heard_via: z.enum(HEARD_VIA, { error: 'Choose one' }),
    heard_other: z.string().trim().max(60, 'Keep it under 60 characters').default(''),
    bringing_child: z.enum(YES_NO, { error: 'Choose No or Yes' }),
    consent: z.literal(true, { error: 'You need to agree to register' }),
    source: z.string().trim().max(40).default(''),
  })
  // Cross-field rules run even when other fields are invalid (`when`), so people see every error at once.
  // The value may then be partly invalid, so read it defensively.
  .superRefine(
    (value, ctx) => {
      const v = value as Record<string, unknown>
      const text = (key: string) => (typeof v[key] === 'string' ? (v[key] as string).trim() : '')
      if (v.church === 'Other' && text('church_other').length < 2) {
        ctx.addIssue({ code: 'custom', path: ['church_other'], message: 'Enter the name of your church' })
      }
      if (v.heard_via === 'Other' && text('heard_other').length < 2) {
        ctx.addIssue({ code: 'custom', path: ['heard_other'], message: 'Tell us how you heard' })
      }
    },
    { when: () => true },
  )

export type RegistrationInput = z.input<typeof registrationSchema>
export type Registration = z.output<typeof registrationSchema>

/** The shape stored in the database and used by the email (see supabase/migrations/001_init.sql). */
export type RegistrationDetails = {
  full_name: string
  years_married: number
  phone: string
  email: string
  church: (typeof CHURCHES)[number]
  church_other: string
  heard_via: (typeof HEARD_VIA)[number]
  heard_other: string
  bringing_child: boolean
}

export type RegisterPayload = RegistrationDetails & { source: string }

export function toPayload(r: Registration): RegisterPayload {
  return {
    full_name: r.full_name,
    years_married: Number(r.years_married),
    phone: normalizeNigerianPhone(r.phone)!,
    email: r.email.toLowerCase(),
    church: r.church,
    // A stale "Other" value is dropped when a listed option is chosen.
    church_other: r.church === 'Other' ? r.church_other : '',
    heard_via: r.heard_via,
    heard_other: r.heard_via === 'Other' ? r.heard_other : '',
    bringing_child: r.bringing_child === 'Yes',
    source: r.source,
  }
}

/** How a stored answer reads to a person (email, summary screen). */
export const churchLabel = (d: Pick<RegistrationDetails, 'church' | 'church_other'>) =>
  d.church === 'Other' ? d.church_other : d.church
export const heardLabel = (d: Pick<RegistrationDetails, 'heard_via' | 'heard_other'>) =>
  d.heard_via === 'Other' ? `Other: ${d.heard_other}` : d.heard_via

/** Field name → first error message, for the API's 400 response and the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] ??= issue.message
  }
  return out
}
