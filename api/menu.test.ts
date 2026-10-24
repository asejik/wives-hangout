import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const menuStatus = vi.fn()
const menuLookup = vi.fn()
const chooseMeal = vi.fn()
const setMealTable = vi.fn()
const rateLimitHit = vi.fn()
vi.mock('./_lib/db.js', () => ({ menuStatus, menuLookup, chooseMeal, setMealTable, rateLimitHit }))

const { default: menu } = await import('./menu.js')
const { default: lookup } = await import('./menu-lookup.js')
const { default: choose } = await import('./menu-choose.js')
const { default: table } = await import('./menu-table.js')

type Handler = (req: ApiRequest, res: ApiResponse) => unknown
async function call(handler: Handler, method: string, body?: unknown) {
  const out = { statusCode: 0, body: undefined as unknown, headers: {} as Record<string, string> }
  const res = {
    status(code: number) { out.statusCode = code; return res },
    json(b: unknown) { out.body = b; return res },
    setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v },
  }
  await handler({ method, body, headers: { 'x-real-ip': '203.0.113.9' } } as unknown as ApiRequest, res as unknown as ApiResponse)
  return out
}

const items = [{ item_id: 'fried-rice', name: 'Fried rice', quantity: 10, remaining: 9 }]
const choice = { item_id: 'fried-rice', item_name: 'Fried rice', code: 'K7QX', chosen_at: 'Fri 23 Oct, 09:15 PM', table_no: '14' }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SUPABASE_URL = 'https://x.supabase.co'
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_x'
  process.env.EVENT_SLUG = 'wives-hangout-2026-dev'
  process.env.EMAIL_MODE = 'log'
  delete process.env.MENU_OPENS_AT
  process.env.MENU_CLOSES_AT = '2999-01-01T00:00:00+01:00'
  menuStatus.mockResolvedValue(items)
  rateLimitHit.mockResolvedValue(true)
})

describe('GET /api/menu', () => {
  it('returns the menu with counts and the window state, briefly cacheable', async () => {
    const res = await call(menu, 'GET')
    expect(res).toMatchObject({ statusCode: 200, body: { state: 'open', items } })
    expect(res.headers['cache-control']).toContain('s-maxage=3')
    expect(menuStatus).toHaveBeenCalledWith('wives-hangout-2026-dev')
  })
  it('says closed after the closing time (default: 8 PM on the day)', async () => {
    process.env.MENU_CLOSES_AT = '2020-01-01T00:00:00+01:00'
    expect((await call(menu, 'GET')).body).toMatchObject({ state: 'closed' })
    delete process.env.MENU_CLOSES_AT
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-10-24T19:59:59+01:00'))
      expect((await call(menu, 'GET')).body).toMatchObject({ state: 'open' })
      vi.setSystemTime(new Date('2026-10-24T20:00:00+01:00'))
      expect((await call(menu, 'GET')).body).toMatchObject({ state: 'closed' })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('POST /api/menu-lookup', () => {
  it('finds her by phone (any format) or email, and passes the normalised value', async () => {
    menuLookup.mockResolvedValue({ status: 'found', full_name: 'Funmilayo Adeyemi', choice: null })
    expect((await call(lookup, 'POST', { who: '+234 801 234 5678' })).body).toEqual({ status: 'found', full_name: 'Funmilayo Adeyemi', choice: null })
    expect(menuLookup).toHaveBeenLastCalledWith('wives-hangout-2026-dev', { phone: '08012345678', email: '' })
    await call(lookup, 'POST', { who: 'Funmi@Example.com' })
    expect(menuLookup).toHaveBeenLastCalledWith('wives-hangout-2026-dev', { phone: '', email: 'funmi@example.com' })
  })
  it('rejects something that is neither a phone nor an email, without touching the database', async () => {
    expect((await call(lookup, 'POST', { who: 'Funmilayo' })).statusCode).toBe(400)
    expect(menuLookup).not.toHaveBeenCalled()
  })
  it('rate-limits per network', async () => {
    rateLimitHit.mockResolvedValue(false)
    expect((await call(lookup, 'POST', { who: '08012345678' })).statusCode).toBe(429)
    expect(menuLookup).not.toHaveBeenCalled()
  })
})

describe('POST /api/menu-choose', () => {
  it('chooses, and returns her choice with fresh counts', async () => {
    chooseMeal.mockResolvedValue({ status: 'created', full_name: 'Funmilayo Adeyemi', choice })
    const res = await call(choose, 'POST', { who: '08012345678', item: 'fried-rice', table: '14' })
    expect(res).toMatchObject({ statusCode: 200, body: { status: 'created', choice, items } })
    expect(chooseMeal).toHaveBeenCalledWith('wives-hangout-2026-dev', { phone: '08012345678', email: '' }, 'fried-rice', '14')
  })
  it('passes through sold out and already chosen', async () => {
    chooseMeal.mockResolvedValue({ status: 'sold_out' })
    expect((await call(choose, 'POST', { who: '08012345678', item: 'fried-rice', table: '14' })).body).toMatchObject({ status: 'sold_out', items })
    chooseMeal.mockResolvedValue({ status: 'already_chosen', full_name: 'F A', choice })
    expect((await call(choose, 'POST', { who: '08012345678', item: 'asun-rice', table: '14' })).body).toMatchObject({ status: 'already_chosen', choice })
  })
  it('refuses outside the window (403) and bad input (400), without touching the database', async () => {
    process.env.MENU_CLOSES_AT = '2020-01-01T00:00:00+01:00'
    expect(await call(choose, 'POST', { who: '08012345678', item: 'fried-rice', table: '14' })).toMatchObject({ statusCode: 403, body: { status: 'closed' } })
    process.env.MENU_CLOSES_AT = '2999-01-01T00:00:00+01:00'
    expect((await call(choose, 'POST', { who: '08012345678', item: 'Fried Rice; drop table', table: '14' })).statusCode).toBe(400)
    expect((await call(choose, 'POST', { who: 'nobody', item: 'fried-rice', table: '14' })).statusCode).toBe(400)
    expect(chooseMeal).not.toHaveBeenCalled()
  })
  it('requires a plain table number, without touching the database', async () => {
    for (const bad of [undefined, '', '0', 'T3', '1000', 'fourteen']) {
      expect(await call(choose, 'POST', { who: '08012345678', item: 'fried-rice', table: bad }), String(bad)).toMatchObject({ statusCode: 400, body: { status: 'invalid_table' } })
    }
    expect(chooseMeal).not.toHaveBeenCalled()
  })

  it('returns 502 when the database fails', async () => {
    chooseMeal.mockRejectedValue(new Error('choose_meal: timeout'))
    expect((await call(choose, 'POST', { who: '08012345678', item: 'fried-rice', table: '14' })).statusCode).toBe(502)
  })
})

describe('POST /api/menu-table', () => {
  it('adds or corrects the table on her existing choice', async () => {
    setMealTable.mockResolvedValue({ status: 'updated', full_name: 'F A', choice: { ...choice, table_no: '9' } })
    const res = await call(table, 'POST', { who: 'funmi@example.com', table: ' 9 ' })
    expect(res).toMatchObject({ statusCode: 200, body: { status: 'updated', choice: { table_no: '9' } } })
    expect(setMealTable).toHaveBeenCalledWith('wives-hangout-2026-dev', { phone: '', email: 'funmi@example.com' }, '9')
  })
  it('passes through no_choice / not_found, and rejects a bad table or a closed window', async () => {
    setMealTable.mockResolvedValue({ status: 'no_choice' })
    expect((await call(table, 'POST', { who: '08012345678', table: '3' })).body).toEqual({ status: 'no_choice' })
    expect((await call(table, 'POST', { who: '08012345678', table: 'A1' })).statusCode).toBe(400)
    process.env.MENU_CLOSES_AT = '2020-01-01T00:00:00+01:00'
    expect((await call(table, 'POST', { who: '08012345678', table: '3' })).statusCode).toBe(403)
  })
})
