import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'

// Runs Code.gs in Node against a fake Sheet that coerces values the way Google Sheets does
// ("08012345678" → 8012345678, "=X" → formula) unless prefixed with '.

type Cell = string | number | Date | { formula: string }

function sheetsCoerce(v: unknown): Cell {
  if (typeof v !== 'string') return v as Cell
  if (v.startsWith("'")) return v.slice(1)
  if (v.startsWith('=')) return { formula: v }
  if (/^\d+(\.\d+)?(e\d+)?$/i.test(v)) return Number(v)
  return v
}

type Call = { fn: string; body: Record<string, unknown> }

type Summary = Partial<Record<'total' | 'bringing_child' | 'last_hour' | 'last_24h' | 'unsynced' | 'unsynced_oldest_minutes' | 'failed' | 'deferred' | 'exhausted' | 'logged' | 'sent', number>>

function load(opts: {
  pending?: Record<string, string | number>[]; existingIds?: string[]; retryUrl?: string; failRpc?: string
  alertEmail?: string; slug?: string; summary?: Summary
  meals?: Record<string, string>[]; menu?: { name: string; quantity: number; remaining: number }[]
} = {}) {
  // Separate fake tabs for the meal snapshots (row 1 = header).
  const tabs = new Map<string, Cell[][]>()
  const tab = (name: string) => ({
    clearContents: () => tabs.set(name, []),
    getRange: (row: number) => ({
      setValues: (values: unknown[][]) => values.forEach((v, i) => (tabs.get(name)![row - 1 + i] = v.map(sheetsCoerce))),
      setFontWeight: () => {},
    }),
    setFrozenRows: () => {},
  })
  const tabsAsked: string[] = []
  const rows: Cell[][] = (opts.existingIds ?? []).map((id) => [id])
  const calls: Call[] = []
  const pings: string[] = []
  const mails: { to: string; subject: string; body: string }[] = []
  const cache = new Map<string, string>()
  const sheet = {
    getLastRow: () => rows.length + 1,
    getRange: (row: number, col: number, nr: number, nc: number) => ({
      getValues: () => rows.slice(row - 2, row - 2 + nr).map((r) => r.slice(col - 1, col - 1 + nc)),
      setValues: (values: unknown[][]) => values.forEach((v, i) => (rows[row - 2 + i] = v.map(sheetsCoerce))),
    }),
    appendRow: () => {},
  }
  const props: Record<string, string> = {
    SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x', EVENT_SLUG: opts.slug ?? 'wives-hangout-2026',
    ...(opts.retryUrl ? { RETRY_URL: opts.retryUrl, RETRY_SECRET: 'r' } : {}),
    ...(opts.alertEmail ? { ALERT_EMAIL: opts.alertEmail } : {}),
  }
  const response = (code: number, body: unknown) => ({ getResponseCode: () => code, getContentText: () => (body === undefined ? '' : JSON.stringify(body)) })
  const globals = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name: string) => (name.startsWith('Meal') ? (tabs.has(name) ? tab(name) : null) : (tabsAsked.push(name), sheet)),
        insertSheet: (name: string) => (tabs.set(name, []), tab(name)),
      }),
      flush: () => {},
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => cache.set(k, v) }) },
    MailApp: { sendEmail: (to: string, subject: string, body: string) => mails.push({ to, subject, body }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null }) },
    UrlFetchApp: {
      fetch: (url: string, o: { payload?: string; headers: Record<string, string> }) => {
        if (!url.includes('/rest/v1/rpc/')) { pings.push(url); return response(200, { status: 'ok' }) }
        const fn = url.split('/rpc/')[1]
        calls.push({ fn, body: JSON.parse(o.payload ?? '{}') })
        if (fn === opts.failRpc) return response(500, { message: 'boom' })
        if (fn === 'sheet_pending') return response(200, opts.pending ?? [])
        if (fn === 'meal_list') return response(200, opts.meals ?? [])
        if (fn === 'menu_status') return response(200, opts.menu ?? [])
        if (fn === 'ops_summary') return response(200, { total: 0, bringing_child: 0, last_hour: 0, last_24h: 0, unsynced: 0, unsynced_oldest_minutes: 0, failed: 0, deferred: 0, exhausted: 0, logged: 0, sent: 0, ...opts.summary })
        return response(200, 1)
      },
    },
  }
  const src = readFileSync(new URL('./Code.gs', import.meta.url), 'utf8')
  const fns = new Function(...Object.keys(globals), `${src}; return { syncFromSupabase, dailyDigest, syncMeals, REGISTRATION_HEADERS };`)(...Object.values(globals))
  return {
    sync: fns.syncFromSupabase as () => number | null, digest: fns.dailyDigest as () => void,
    headers: fns.REGISTRATION_HEADERS as string[], rows, calls, pings, mails, tabsAsked,
    syncMeals: fns.syncMeals as () => number | null, tabs,
  }
}

const reg = (id: string, extra: Record<string, string | number> = {}) => ({
  id, created_at: '2026-10-09 10:00:00', full_name: 'Funmi', years_married: 7, occupation: 'Banker', phone: '08012345678', email: 'f@x.co',
  church: 'Other', church_other: 'Living Faith', heard_via: 'Other', heard_other: 'Radio', bringing_child: 'No',
  consent_at: '2026-10-09 10:00:00', source: '', ...extra,
})

describe('syncFromSupabase (Apps Script)', () => {
  let gas: ReturnType<typeof load>

  beforeEach(() => { gas = load({ pending: [reg('a'), reg('b')] }) })

  it('appends new rows to the Registrations tab and keeps the phone as text (leading 0)', () => {
    expect(gas.sync()).toBe(2)
    const row = gas.rows[0]
    expect(row[gas.headers.indexOf('phone')]).toBe('08012345678')
    expect(row[gas.headers.indexOf('years_married')]).toBe(7)
    expect(row[gas.headers.indexOf('church_other')]).toBe('Living Faith')
    expect(row[gas.headers.indexOf('synced_at')]).toBeInstanceOf(Date)
    expect(gas.tabsAsked).toEqual(['Registrations'])
    expect(row[gas.headers.indexOf('occupation')]).toBe('Banker')
    expect(gas.headers.at(-1)).toBe('occupation') // appended last: existing Sheet rows don't shift
  })

  it('sends dev-slug rows to a separate DEV tab, never the real one', () => {
    const g = load({ pending: [reg('a')], slug: 'wives-hangout-2026-dev' })
    g.sync()
    expect(g.tabsAsked).toEqual(['Registrations (DEV)'])
    expect(g.calls[0].body).toMatchObject({ p_event: 'wives-hangout-2026-dev' })
  })

  it('asks Supabase for production rows only', () => {
    gas.sync()
    expect(gas.calls[0]).toEqual({ fn: 'sheet_pending', body: { p_event: 'wives-hangout-2026', p_limit: 500 } })
  })

  it('marks every fetched row synced after writing', () => {
    gas.sync()
    expect(gas.calls.map((c) => c.fn)).toEqual(['sheet_pending', 'sheet_mark_synced'])
    expect(gas.calls[1].body).toEqual({ p_ids: ['a', 'b'] })
  })

  it('never duplicates a row already in the Sheet (re-run after a crash)', () => {
    const g = load({ pending: [reg('a'), reg('b')], existingIds: ['a'] })
    expect(g.sync()).toBe(1)
    expect(g.rows.map((r) => r[0])).toEqual(['a', 'b'])
    expect(g.calls[1].body).toEqual({ p_ids: ['a', 'b'] })
  })

  it('neutralises formulas in user input', () => {
    const g = load({ pending: [reg('a', { full_name: '=HYPERLINK("http://evil")', church_other: '+1', heard_other: '@x', source: '-2' })] })
    g.sync()
    expect(g.rows[0][g.headers.indexOf('full_name')]).toBe('=HYPERLINK("http://evil")')
    expect(g.rows[0][g.headers.indexOf('church_other')]).toBe('+1')
    expect(g.rows[0][g.headers.indexOf('heard_other')]).toBe('@x')
    expect(g.rows[0][g.headers.indexOf('source')]).toBe('-2')
  })

  it('does not mark rows synced if fetching fails', () => {
    const g = load({ failRpc: 'sheet_pending' })
    expect(() => g.sync()).toThrow(/sheet_pending failed: HTTP 500/)
    expect(g.calls.map((c) => c.fn)).toEqual(['sheet_pending'])
  })

  it('does nothing extra when there is nothing pending', () => {
    const g = load({ pending: [] })
    expect(g.sync()).toBe(0)
    expect(g.calls.map((c) => c.fn)).toEqual(['sheet_pending'])
  })

  it('pings the retry endpoint only when RETRY_URL is set', () => {
    gas.sync()
    expect(gas.pings).toEqual([])
    const g = load({ pending: [], retryUrl: 'https://site/api/email-retry' })
    g.sync()
    expect(g.pings).toEqual(['https://site/api/email-retry'])
  })
})

describe('alerts and daily digest', () => {
  it('sends nothing when ALERT_EMAIL is not set', () => {
    const g = load({ summary: { exhausted: 3 } })
    g.sync()
    expect(g.mails).toEqual([])
    expect(g.calls.map((c) => c.fn)).not.toContain('ops_summary')
  })

  it('alerts once (not every 5 minutes) when emails are exhausted', () => {
    const g = load({ alertEmail: 'builder@x.co', summary: { exhausted: 2 } })
    g.sync(); g.sync(); g.sync()
    expect(g.mails).toHaveLength(1)
    expect(g.mails[0]).toMatchObject({ to: 'builder@x.co', subject: '[Wives Hangout] 2 confirmation email(s) failed 5 times' })
  })

  it('alerts when the Sheet copy is stalled or many emails are failing', () => {
    const g = load({ alertEmail: 'b@x.co', summary: { unsynced: 4, unsynced_oldest_minutes: 45, failed: 12 } })
    g.sync()
    expect(g.mails.map((m) => m.subject).sort()).toEqual([
      '[Wives Hangout] 12 confirmation emails are failing',
      '[Wives Hangout] Sheet copy is 45 minutes behind',
    ])
  })

  it('flags logged-only emails for the production slug, but not the dev slug', () => {
    const dev = load({ alertEmail: 'b@x.co', slug: 'wives-hangout-2026-dev', summary: { logged: 5 } })
    dev.sync()
    expect(dev.mails).toEqual([])
    const prod = load({ alertEmail: 'b@x.co', summary: { logged: 5 } })
    prod.sync()
    expect(prod.mails[0].subject).toBe('[Wives Hangout] Production emails are in log mode')
  })

  it("explains Gmail's daily limit separately from real failures", () => {
    const g = load({ alertEmail: 'b@x.co', summary: { failed: 15, deferred: 15 } })
    g.sync()
    expect(g.mails.map((m) => m.subject)).toEqual(["[Wives Hangout] Gmail's daily sending limit was reached"])
  })

  it('alerts when the sync itself fails', () => {
    const g = load({ alertEmail: 'b@x.co', failRpc: 'sheet_pending' })
    expect(() => g.sync()).toThrow()
    expect(g.mails[0].subject).toBe('[Wives Hangout] Sheet sync is failing')
  })

  it('alerts on a registration spike above 60 an hour', () => {
    const quiet = load({ alertEmail: 'b@x.co', summary: { last_hour: 60 } })
    quiet.sync()
    expect(quiet.mails).toEqual([])
    const g = load({ alertEmail: 'b@x.co', summary: { last_hour: 61 } })
    g.sync()
    expect(g.mails[0].subject).toBe('[Wives Hangout] 61 registrations in the last hour')
  })

  it('sends a daily summary with the counts', () => {
    const g = load({ alertEmail: 'b@x.co', summary: { total: 112, bringing_child: 9, last_24h: 37, sent: 105, failed: 2 } })
    g.digest()
    expect(g.mails[0].subject).toBe('[Wives Hangout] Daily summary: 112 registered (+37 in 24h)')
    expect(g.mails[0].body).toContain('Need to bring a child: 9')
    expect(g.mails[0].body).toContain('Emails failing (still retrying): 2')
  })
})

describe('syncMeals (Apps Script)', () => {
  const meals = [
    { table_no: '3', full_name: 'Funmi A', dish: 'Fried rice', code: '2E45', phone: '08012345678', chosen_at: '2026-10-23 21:00:00' },
    { table_no: '', full_name: '=EVIL()', dish: 'Asun rice', code: 'K7QX', phone: '08099999999', chosen_at: '2026-10-23 21:01:00' },
  ]
  const menu = [{ name: 'Fried rice', quantity: 10, remaining: 9 }, { name: 'Asun rice', quantity: 10, remaining: 9 }]

  it('writes the Meals tab (phone and code kept as text, formulas neutralised) and the totals', () => {
    const g = load({ meals, menu })
    expect(g.syncMeals()).toBe(2)
    const m = g.tabs.get('Meals')!
    expect(m[0]).toEqual(['full_name', 'dish', 'code', 'phone', 'chosen_at'])
    expect(m[1]).toEqual(['Funmi A', 'Fried rice', '2E45', '08012345678', '2026-10-23 21:00:00'])
    expect(m[2][0]).toBe('=EVIL()') // stored as text, not a formula
    const totals = g.tabs.get('Meal totals')!
    expect(totals[1]).toEqual(['Fried rice', 10, 1, 9])
    expect(totals.at(-1)).toEqual(['TOTAL', 20, 2, 18])
  })

  it('replaces the snapshot each run (no duplicates)', () => {
    const g = load({ meals, menu })
    g.syncMeals(); g.syncMeals()
    expect(g.tabs.get('Meals')!).toHaveLength(3)
  })

  it('uses separate tabs for the dev slug', () => {
    const g = load({ meals, menu, slug: 'wives-hangout-2026-dev' })
    g.syncMeals()
    expect(g.tabs.has('Meals (DEV)')).toBe(true)
    expect(g.tabs.has('Meals')).toBe(false)
  })

  it('never throws (logs instead), e.g. before migration 003 is run', () => {
    const g = load({ failRpc: 'meal_list' })
    expect(g.syncMeals()).toBeNull()
  })
})
