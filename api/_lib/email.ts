import { EVENT, yearsMarriedLabel } from '../../shared/event.js'
import { churchLabel, heardLabel, type RegistrationDetails } from '../../shared/registration.js'
import { CONFIRMATION_HTML } from './email-template.js'
import type { Mail } from './mailer.js'

// HTML comes from emails/Confirmation.tsx (React Email + Tailwind), pre-rendered into
// email-template.ts by `npm run email:build`. Values are HTML-escaped before insertion.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** Absolute site URL for images and the footer. Vercel exposes the production domain at runtime.
 *  Elsewhere (local tests, scripts) use the production address: an email recipient can't load localhost. */
function siteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '')
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return host ? `https://${host}` : EVENT.productionUrl
}

export function fillTemplate(template: string, values: Record<string, string>): string {
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) =>
    key in values ? escapeHtml(values[key]) : match,
  )
  const left = html.match(/\{\{[A-Z_]+\}\}/)
  if (left) throw new Error(`email template placeholder not filled: ${left[0]}`)
  return html
}

export function confirmationEmail(d: RegistrationDetails, resend: boolean): Mail {
  const firstName = d.full_name.trim().split(/\s+/)[0] ?? ''
  const heading = resend ? `You're already registered, ${firstName}` : `You're registered, ${firstName}!`
  const intro = resend
    ? `Someone tried to register again with your phone number or email. You only need to register once. Here are the details we have for you.`
    : `Thank you for registering for ${EVENT.name}. Here's a copy of the details you gave us.`
  const url = siteUrl()
  const rows: [string, string][] = [
    ['Full name', d.full_name],
    ['Years married', yearsMarriedLabel(d.years_married)],
    ['Phone (WhatsApp)', d.phone],
    ['Email', d.email],
    ['Church', churchLabel(d)],
    ['How you heard', heardLabel(d)],
    ['Bringing a child', d.bringing_child ? 'Yes' : 'No'],
  ]

  const html = fillTemplate(CONFIRMATION_HTML, {
    PREVIEW: `${EVENT.name}: ${EVENT.date}, ${EVENT.time} at ${EVENT.venue}.`,
    HEADING: heading,
    INTRO: intro,
    FULL_NAME: d.full_name,
    YEARS_MARRIED: yearsMarriedLabel(d.years_married),
    PHONE: d.phone,
    EMAIL: d.email,
    CHURCH: churchLabel(d),
    HEARD: heardLabel(d),
    CHILD: d.bringing_child ? 'Yes' : 'No',
    SITE_URL: url,
  })

  const text = [
    heading,
    '',
    intro,
    '',
    'YOUR REGISTRATION',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'THE EVENT',
    `${EVENT.name} by ${EVENT.host}`,
    `Date: ${EVENT.date}`,
    `Time: ${EVENT.time}`,
    `Venue: ${EVENT.venue}`,
    '',
    'We look forward to seeing you!',
    EVENT.host,
    '',
    `You're receiving this because you registered for ${EVENT.name} at ${url}. If a detail is wrong or this wasn't you, reply to this email.`,
    `Privacy notice: ${url}/privacy`,
  ].join('\n')

  const subject = resend ? `Your ${EVENT.name} registration` : `You're registered: ${EVENT.name}, Sat 24 Oct`
  return { to: d.email, subject, text, html }
}
