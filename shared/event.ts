// Everything specific to this event. To reuse the site for another event, change this file,
// the artwork in public/assets, and the env vars (EVENT_SLUG, close time).
// Used by both the page (src/) and the server (api/).

export const EVENT = {
  name: 'Wives Hangout',
  host: 'Citizens of Light Church',
  /** Privacy requests and questions. */
  contactEmail: 'clcchurchmedia@gmail.com',
  /** Production address (printed on the QR code). Emails fall back to it when not running on Vercel. */
  productionUrl: 'https://wives-hangout.vercel.app',
  date: 'Saturday, 24 October 2026',
  time: '4PM',
  /** Always shown in full. */
  venue: 'Freedom Place, Ilesanmi Bus Stop, Tanke, Ilorin',
  /** For structured data (SEO). The end time isn't known, so the end is a date only. */
  schedule: { start: '2026-10-24T16:00:00+01:00', endDate: '2026-10-24' },
  place: { name: 'Freedom Place', street: 'Ilesanmi Bus Stop, Tanke', locality: 'Ilorin', region: 'Kwara', country: 'NG' },
} as const

/** Must match the CHECKs in supabase/migrations/001_init.sql. */
export const CHURCH_HOME = 'Citizens of Light Church'
export const CHURCHES = [CHURCH_HOME, 'Other'] as const
export const HEARD_VIA = ['WhatsApp', 'Instagram/Facebook', 'A friend or family member', 'Church announcement', 'Flyer', 'Other'] as const
export const YES_NO = ['No', 'Yes'] as const
export const MAX_YEARS_MARRIED = 80

export const COPY = {
  /** Wording from the church's brief, verbatim. */
  childQuestion:
    'This event is designed for wives to attend without children. Will you need to bring a child due to childcare limitations?',
  consent:
    'By registering, you agree that Citizens of Light Church may use your details to plan Wives Hangout ' +
    '(headcount, seating and childcare) and to contact you about it by phone, WhatsApp or email. Your details are ' +
    "stored securely with the church's service providers (Supabase and Google) and will not be shared outside the church.",
} as const

/** "Less than a year", "1 year", "12 years". */
export function yearsMarriedLabel(years: number): string {
  if (years === 0) return 'Less than a year'
  return years === 1 ? '1 year' : `${years} years`
}
