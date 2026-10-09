import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const emailRetryBatch = vi.fn()
const setEmailStatus = vi.fn()
vi.mock('./_lib/db.js', () => ({ emailRetryBatch, setEmailStatus }))

const sendMail = vi.fn()
vi.mock('./_lib/mailer.js', async (orig) => ({ ...(await orig<typeof import('./_lib/mailer.js')>()), sendMail }))

const { default: handler } = await import('./email-retry.js')

async function call(authorization?: string, method = 'POST') {
  const out = { statusCode: 0, body: undefined as unknown }
  const res = {
    status(code: number) { out.statusCode = code; return res },
    json(b: unknown) { out.body = b; return res },
  }
  await handler({ method, headers: { authorization } } as unknown as ApiRequest, res as unknown as ApiResponse)
  return out
}

const row = (id: string) => ({
  id,
  details: {
    full_name: `${id} A`, years_married: 2, phone: '08012345678', email: `${id}@x.co`, church: 'Citizens of Light Church',
    church_other: '', heard_via: 'Flyer', heard_other: '', bringing_child: false,
  },
})
const dailyLimit = Object.assign(new Error('Message failed'), { response: '550 5.4.5 Daily user sending limit exceeded.' })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RETRY_SECRET = 'retry-secret-value'
  process.env.EVENT_SLUG = 'wives-hangout-2026-dev'
  process.env.SUPABASE_URL = 'https://x.supabase.co'
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_x'
  process.env.EMAIL_MODE = 'log'
  setEmailStatus.mockResolvedValue(null)
})

describe('POST /api/email-retry', () => {
  it('rejects a missing or wrong secret', async () => {
    expect((await call()).statusCode).toBe(401)
    expect((await call('Bearer nope')).statusCode).toBe(401)
    expect(emailRetryBatch).not.toHaveBeenCalled()
  })

  it('rejects everything when RETRY_SECRET is unset', async () => {
    delete process.env.RETRY_SECRET
    expect((await call('Bearer ')).statusCode).toBe(401)
  })

  it('re-sends each row from its stored details and records the outcome', async () => {
    emailRetryBatch.mockResolvedValue([row('a'), row('b')])
    sendMail.mockResolvedValueOnce('sent').mockRejectedValueOnce(new Error('421'))
    const res = await call('Bearer retry-secret-value')
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ processed: 2, SENT: 1, FAILED: 1 })
    expect(emailRetryBatch).toHaveBeenCalledWith('wives-hangout-2026-dev', 10)
    expect(sendMail.mock.calls[0][0].to).toBe('a@x.co')
    expect(setEmailStatus).toHaveBeenCalledWith('a', 'SENT')
    expect(setEmailStatus).toHaveBeenCalledWith('b', 'FAILED')
  })

  it("stops sending once Gmail's daily limit is hit and defers the rest (no attempts used)", async () => {
    emailRetryBatch.mockResolvedValue([row('a'), row('b'), row('c')])
    sendMail.mockResolvedValueOnce('sent').mockRejectedValueOnce(dailyLimit)
    const res = await call('Bearer retry-secret-value')
    expect(res.body).toMatchObject({ processed: 3, SENT: 1, DEFERRED: 2 })
    expect(sendMail).toHaveBeenCalledTimes(2)
    expect(setEmailStatus).toHaveBeenCalledWith('b', 'FAILED', 60)
    expect(setEmailStatus).toHaveBeenCalledWith('c', 'FAILED', 60)
  })
})
