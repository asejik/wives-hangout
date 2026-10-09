import { describe, expect, it } from 'vitest'
import type { RegistrationDetails } from '../../shared/registration.js'
import { confirmationEmail, fillTemplate } from './email.js'

const details: RegistrationDetails = {
  full_name: 'Funmilayo Adeyemi', years_married: 7, phone: '08012345678', email: 'funmi@example.com',
  church: 'Citizens of Light Church', church_other: '', heard_via: 'WhatsApp', heard_other: '', bringing_child: false,
}

describe('confirmation email', () => {
  it('is a copy of every registration detail, escaped', () => {
    const m = confirmationEmail({ ...details, full_name: 'Funmi <script>alert(1)</script> A', church: 'Other', church_other: 'Faith & Hope' }, false)
    expect(m.to).toBe('funmi@example.com')
    expect(m.html).not.toMatch(/\{\{[A-Z_]+\}\}/)
    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('Funmi &#60;script&#62;')
    expect(m.html).toContain('Faith &#38; Hope')
    for (const v of ['7 years', '08012345678', 'funmi@example.com', 'WhatsApp']) expect(m.html).toContain(v)
    expect(m.html).toContain('You&#39;re registered, Funmi')
    expect(m.subject).toBe("You're registered: Wives Hangout, Sat 24 Oct")
  })

  it('has a plain-text version with the details and the full event facts', () => {
    const m = confirmationEmail({ ...details, years_married: 0, bringing_child: true, heard_via: 'Other', heard_other: 'Radio' }, false)
    expect(m.text).toContain('Years married: Less than a year')
    expect(m.text).toContain('Bringing a child: Yes')
    expect(m.text).toContain('How you heard: Other: Radio')
    expect(m.text).toContain('Date: Saturday, 24 October 2026')
    expect(m.text).toContain('Venue: Freedom Dome, Ilesanmi Bus Stop, Tanke, Ilorin')
    expect(m.text).toContain('Time: 4:00 PM')
    expect(m.text).toContain('Marriage, Motherhood and Ministry')
    expect(m.text).toContain('/privacy')
  })

  it('uses re-send wording for duplicates', () => {
    const m = confirmationEmail(details, true)
    expect(m.html).toContain('already registered, Funmi')
    expect(m.text).toContain('You only need to register once')
    expect(m.subject).toBe('Your Wives Hangout registration')
  })

  it('uses absolute image and privacy URLs from SITE_URL', () => {
    process.env.SITE_URL = 'https://wives.example/'
    try {
      const html = confirmationEmail(details, false).html
      expect(html).toContain('src="https://wives.example/assets/clc-logo-white.png"')
      expect(html).toContain('src="https://wives.example/assets/email-title.png"')
      expect(html).toContain('href="https://wives.example/privacy"')
    } finally {
      delete process.env.SITE_URL
    }
  })

  it('falls back to the production URL, never localhost (bug: logo broken in an email sent from a laptop)', () => {
    const saved = { s: process.env.SITE_URL, v: process.env.VERCEL_PROJECT_PRODUCTION_URL }
    delete process.env.SITE_URL
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    try {
      const m = confirmationEmail(details, false)
      expect(m.html).toContain('src="https://wives-hangout.vercel.app/assets/clc-logo-white.png"')
      expect(m.html).not.toContain('localhost')
      expect(m.text).not.toContain('localhost')
    } finally {
      if (saved.s !== undefined) process.env.SITE_URL = saved.s
      if (saved.v !== undefined) process.env.VERCEL_PROJECT_PRODUCTION_URL = saved.v
    }
  })

  it('refuses to send with an unfilled placeholder', () => {
    expect(() => fillTemplate('<p>{{CODE}} {{NEW_THING}}</p>', { CODE: 'X' })).toThrow('{{NEW_THING}}')
  })
})
