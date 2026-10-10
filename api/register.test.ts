import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pending: Promise<unknown>[] = []
vi.mock('@vercel/functions', () => ({ waitUntil: (p: Promise<unknown>) => void pending.push(p) }))

const registerAttendee = vi.fn()
const setEmailStatus = vi.fn()
const rateLimitHit = vi.fn()
vi.mock('./_lib/db.js', () => ({ registerAttendee, setEmailStatus, rateLimitHit }))

const sendMail = vi.fn()
vi.mock('./_lib/mailer.js', async (orig) => ({ ...(await orig<typeof import('./_lib/mailer.js')>()), sendMail }))

const { default: handler } = await import('./register.js')

function fakeRes() {
  const out = { statusCode: 0, body: undefined as unknown }
  const res = {
    status(code: number) { out.statusCode = code; return res },
    json(b: unknown) { out.body = b; return res },
  }
  return { out, res: res as unknown as ApiResponse }
}

async function call(body: unknown, method = 'POST') {
  const { out, res } = fakeRes()
  await handler({ method, body, headers: { 'x-real-ip': '203.0.113.7' } } as unknown as ApiRequest, res)
  await Promise.all(pending)
  return out
}

const valid = {
  full_name: 'Funmilayo Adeyemi', years_married: '7', phone: '+234 801 234 5678', email: 'Funmi@Example.com',
  church: 'Citizens of Light Church', heard_via: 'WhatsApp', bringing_child: 'No',
  consent: true, website: '', elapsed_ms: 45_000,
}

const onFile = {
  full_name: 'F A', years_married: 3, phone: '08012345678', email: 'onfile@example.com',
  church: 'Citizens of Light Church', church_other: '', heard_via: 'Flyer', heard_other: '', bringing_child: true,
}

beforeEach(() => {
  pending.length = 0
  vi.clearAllMocks()
  process.env.SUPABASE_URL = 'https://x.supabase.co'
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_x'
  process.env.EVENT_SLUG = 'wives-hangout-2026-dev'
  process.env.EMAIL_MODE = 'log'
  setEmailStatus.mockResolvedValue(null)
  rateLimitHit.mockResolvedValue(true)
  sendMail.mockResolvedValue('sent')
})

describe('POST /api/register', () => {
  it('returns 503 and writes nothing when not configured (production before launch)', async () => {
    delete process.env.SUPABASE_URL
    const res = await call(valid)
    expect(res.statusCode).toBe(503)
    expect(registerAttendee).not.toHaveBeenCalled()
  })

  it('refuses log mode in production instead of silently skipping emails', async () => {
    process.env.VERCEL_ENV = 'production'
    process.env.EVENT_SLUG = 'wives-hangout-2026'
    try {
      const res = await call(valid)
      expect(res.statusCode).toBe(503)
      expect(registerAttendee).not.toHaveBeenCalled()
    } finally {
      delete process.env.VERCEL_ENV
    }
  })

  it('refuses the dev slug in production and the production slug elsewhere (one shared database)', async () => {
    process.env.VERCEL_ENV = 'production'
    process.env.EMAIL_MODE = 'smtp'
    try {
      expect((await call(valid)).statusCode).toBe(503)
    } finally {
      delete process.env.VERCEL_ENV
    }
    process.env.EMAIL_MODE = 'log'
    process.env.EVENT_SLUG = 'wives-hangout-2026'
    expect((await call(valid)).statusCode).toBe(503)
    expect(registerAttendee).not.toHaveBeenCalled()
  })

  it('refuses registrations outside the window (403) without touching the database', async () => {
    process.env.REGISTRATION_CLOSES_AT = '2020-01-01T00:00:00+01:00'
    try {
      const res = await call(valid)
      expect(res).toMatchObject({ statusCode: 403, body: { status: 'closed' } })
      process.env.REGISTRATION_CLOSES_AT = ''
      process.env.REGISTRATION_OPENS_AT = '2999-01-01T00:00:00+01:00'
      expect(await call(valid)).toMatchObject({ statusCode: 403, body: { status: 'not_open' } })
      expect(registerAttendee).not.toHaveBeenCalled()
    } finally {
      delete process.env.REGISTRATION_CLOSES_AT
      delete process.env.REGISTRATION_OPENS_AT
    }
  })

  it.each([
    ['a filled honeypot', { website: 'http://spam.example' }],
    ['a sub-3-second submit', { elapsed_ms: 900 }],
    ['a missing timing field', { elapsed_ms: undefined }],
  ])('treats %s as a bot: duplicate-shaped reply, nothing saved or emailed', async (_label, extra) => {
    const res = await call({ ...valid, ...extra })
    expect(res).toMatchObject({ statusCode: 200, body: { status: 'duplicate' } })
    expect(registerAttendee).not.toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('returns 429 once the network is over its limit, without saving', async () => {
    rateLimitHit.mockResolvedValue(false)
    const res = await call(valid)
    expect(res).toMatchObject({ statusCode: 429, body: { status: 'rate_limited' } })
    expect(registerAttendee).not.toHaveBeenCalled()
  })

  it('keys the limit on a salted hash of the IP, never the raw IP', async () => {
    registerAttendee.mockResolvedValue({ status: 'created', id: 'r1' })
    await call(valid)
    const [key, max, windowSeconds] = rateLimitHit.mock.calls[0]
    expect(key).toMatch(/^[0-9a-f]{64}$/)
    expect(key).not.toContain('203.0.113.7')
    expect([max, windowSeconds]).toEqual([40, 600])
  })

  it('fails open if the limiter itself errors', async () => {
    rateLimitHit.mockRejectedValue(new Error('rate_limit_hit: timeout'))
    registerAttendee.mockResolvedValue({ status: 'created', id: 'r1' })
    expect((await call(valid)).statusCode).toBe(201)
  })

  it('rejects invalid input with the failing fields', async () => {
    const res = await call({ ...valid, phone: '123', consent: false })
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      status: 'invalid',
      fields: { phone: 'Enter an 11-digit number, e.g. 08012345678', consent: 'You need to agree to register' },
    })
    expect(registerAttendee).not.toHaveBeenCalled()
  })

  it('normalises the answers for the database, under the configured event slug', async () => {
    registerAttendee.mockResolvedValue({ status: 'created', id: 'r1' })
    await call({ ...valid, bringing_child: 'Yes', church: 'Other', church_other: 'Living Faith' })
    expect(registerAttendee).toHaveBeenCalledWith('wives-hangout-2026-dev', {
      full_name: 'Funmilayo Adeyemi', years_married: 7, phone: '08012345678', email: 'funmi@example.com',
      church: 'Other', church_other: 'Living Faith', heard_via: 'WhatsApp', heard_other: '', bringing_child: true, source: '',
    })
  })

  it('responds, then emails a copy of the details and records SENT', async () => {
    registerAttendee.mockResolvedValue({ status: 'created', id: 'r1' })
    const res = await call(valid)
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ status: 'created', venue: 'M&S Luxury Hotel, Ojomu Street, Off Basin Road, Ilorin' })
    expect(sendMail.mock.calls[0][0].to).toBe('funmi@example.com')
    expect(sendMail.mock.calls[0][0].text).toContain('Years married: 7 years')
    expect(setEmailStatus).toHaveBeenCalledWith('r1', 'SENT')
  })

  it("defers (no attempt used) when Gmail's daily limit is reached", async () => {
    registerAttendee.mockResolvedValue({ status: 'created', id: 'r1' })
    sendMail.mockRejectedValue(Object.assign(new Error('Message failed'), { response: '550 5.4.5 Daily user sending limit exceeded.' }))
    expect((await call(valid)).statusCode).toBe(201)
    expect(setEmailStatus).toHaveBeenCalledWith('r1', 'FAILED', 60)
  })

  it('records LOGGED in log mode, never SENT', async () => {
    registerAttendee.mockResolvedValue({ status: 'created', id: 'r1' })
    sendMail.mockResolvedValue('logged')
    await call(valid)
    expect(setEmailStatus).toHaveBeenCalledWith('r1', 'LOGGED')
  })

  it('still confirms on screen when email fails, and records FAILED', async () => {
    registerAttendee.mockResolvedValue({ status: 'created', id: 'r1' })
    sendMail.mockRejectedValue(new Error('535 bad credentials'))
    const res = await call(valid)
    expect(res.statusCode).toBe(201)
    expect(setEmailStatus).toHaveBeenCalledWith('r1', 'FAILED')
  })

  it('never reveals stored details for a duplicate; re-sends them to the email on file', async () => {
    registerAttendee.mockResolvedValue({ status: 'duplicate', id: 'r1', resend: true, details: onFile })
    const res = await call({ ...valid, email: 'someone-else@example.com' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ status: 'duplicate' })
    expect(sendMail.mock.calls[0][0].to).toBe('onfile@example.com')
    expect(sendMail.mock.calls[0][0].text).toContain('Years married: 3 years')
  })

  it('does not re-send while throttled', async () => {
    registerAttendee.mockResolvedValue({ status: 'duplicate', id: 'r1', resend: false, details: onFile })
    await call(valid)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('a failed re-send does not downgrade the row', async () => {
    registerAttendee.mockResolvedValue({ status: 'duplicate', id: 'r1', resend: true, details: onFile })
    sendMail.mockRejectedValue(new Error('421 try later'))
    await call(valid)
    expect(setEmailStatus).not.toHaveBeenCalled()
  })

  it('returns 502 when the database fails', async () => {
    registerAttendee.mockRejectedValue(new Error('register_attendee: timeout'))
    const res = await call(valid)
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ status: 'error' })
  })
})
