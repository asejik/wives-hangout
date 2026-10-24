import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

// Runs the real migration in an in-process Postgres (PGlite). Supabase's roles are created first.
const sql = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')
const EVENT = 'wives-hangout-2026'
const DEV = 'wives-hangout-2026-dev'

let db: PGlite

async function rpc<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(query, params)).rows
}

const person = (phone: string, email: string, extra: object = {}) => ({
  full_name: 'Funmilayo Adeyemi', years_married: 7, occupation: 'Nurse', phone, email, church: 'Citizens of Light Church', church_other: '',
  heard_via: 'WhatsApp', heard_other: '', bringing_child: false, source: 'test', ...extra,
})

async function register(p: object, event = EVENT) {
  const [row] = await rpc<{ r: Record<string, unknown> }>('select public.register_attendee($1, $2::jsonb) as r', [event, JSON.stringify(p)])
  return row.r
}

const anonCanExecute = async (signature: string) =>
  (await rpc<{ ok: boolean }>(`select has_function_privilege('anon', $1, 'execute') as ok`, [signature]))[0].ok

beforeAll(async () => {
  db = new PGlite() // cold start can take several seconds
  await db.exec(`create role anon; create role authenticated; create role service_role;`)
}, 60_000)

beforeEach(async () => {
  // Fresh schema per test: roll back, then migrate (also proves the pair round-trips).
  await db.exec(sql('005_pineapple_fried_rice.down.sql'))
  await db.exec(sql('003_menu.down.sql')) // also removes 004's functions
  await db.exec(sql('001_init.down.sql'))
  await db.exec(sql('001_init.sql'))
  await db.exec(sql('002_occupation.sql'))
  await db.exec(sql('003_menu.sql'))
  await db.exec(sql('004_table.sql'))
  await db.exec(sql('005_pineapple_fried_rice.sql'))
})

describe('001_init: registrations', () => {
  it('creates a registration', async () => {
    const r = await register(person('08012345678', 'funmi@example.com'))
    expect(r.status).toBe('created')
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('treats the same phone or the same email as a duplicate, returning the stored details (server only)', async () => {
    const first = await register(person('08012345678', 'funmi@example.com', { years_married: 12 }))
    const byPhone = await register(person('08012345678', 'other@example.com'))
    const byEmail = await register(person('09011112222', 'FUNMI@example.com'))
    expect(byPhone).toMatchObject({ status: 'duplicate', id: first.id })
    expect(byPhone.details).toMatchObject({ email: 'funmi@example.com', years_married: 12, phone: '08012345678' })
    expect(byEmail.status).toBe('duplicate')
    expect((await rpc('select count(*)::int as n from public.registrations'))[0]).toEqual({ n: 1 })
  })

  it('throttles re-sends: none within 10 minutes of creation, then at most one per 10 minutes', async () => {
    const first = await register(person('08012345678', 'funmi@example.com'))
    expect((await register(person('08012345678', 'x@example.com'))).resend).toBe(false)
    await db.query(`update public.registrations set last_resend_at = now() - interval '11 minutes' where id = $1`, [first.id])
    expect((await register(person('08012345678', 'x@example.com'))).resend).toBe(true)
    expect((await register(person('08012345678', 'x@example.com'))).resend).toBe(false)
  })

  it('keeps production and dev rows apart (one database, two slugs)', async () => {
    await register(person('08012345678', 'funmi@example.com'), EVENT)
    expect((await register(person('08012345678', 'funmi@example.com'), DEV)).status).toBe('created')
    expect(await rpc(`select * from public.sheet_pending($1)`, [EVENT])).toHaveLength(1)
    const [{ s }] = await rpc<{ s: Record<string, number> }>(`select public.ops_summary($1) as s`, [EVENT])
    expect(s.total).toBe(1)
  })

  it('stores Other church and Other source text', async () => {
    const r = await register(person('08012345678', 'f@example.com', { church: 'Other', church_other: 'Living Faith', heard_via: 'Other', heard_other: 'Radio' }))
    const [row] = await rpc(`select church, church_other, heard_via, heard_other from public.registrations where id = $1`, [r.id])
    expect(row).toEqual({ church: 'Other', church_other: 'Living Faith', heard_via: 'Other', heard_other: 'Radio' })
  })

  it('rejects invalid data at the database level', async () => {
    await expect(register(person('8012345678', 'a@example.com'))).rejects.toThrow(/check constraint/)
    await expect(register(person('08012345678', 'a@example.com', { years_married: 81 }))).rejects.toThrow(/check constraint/)
    await expect(register(person('08012345678', 'a@example.com', { years_married: -1 }))).rejects.toThrow(/check constraint/)
    await expect(register(person('08012345678', 'a@example.com', { church: 'Somewhere' }))).rejects.toThrow(/check constraint/)
    await expect(register(person('08012345678', 'a@example.com', { church: 'Other', church_other: '' }))).rejects.toThrow(/check constraint/)
    await expect(register(person('08012345678', 'a@example.com', { heard_via: 'TikTok' }))).rejects.toThrow(/check constraint/)
    await expect(register(person('08012345678', 'a@example.com', { heard_via: 'Other' }))).rejects.toThrow(/check constraint/)
    await expect(register(person('08012345678', 'a@example.com', { bringing_child: null }))).rejects.toThrow(/null value/)
  })
})

describe('001_init: email status and retries', () => {
  it('records email status and attempts', async () => {
    const r = await register(person('08012345678', 'funmi@example.com'))
    await db.query('select public.set_email_status($1, $2)', [r.id, 'FAILED'])
    await db.query('select public.set_email_status($1, $2)', [r.id, 'SENT'])
    const [row] = await rpc<{ email_status: string; email_attempts: number; emailed_at: Date | null }>(
      'select email_status, email_attempts, emailed_at from public.registrations where id = $1', [r.id])
    expect(row).toMatchObject({ email_status: 'SENT', email_attempts: 2 })
    expect(row.emailed_at).not.toBeNull()
  })

  it('selects FAILED and stale PENDING rows for retry, under 5 attempts, with their details', async () => {
    const failed = await register(person('08011111111', 'f@example.com'))
    const stale = await register(person('08022222222', 's@example.com'))
    const fresh = await register(person('08033333333', 'n@example.com'))
    const exhausted = await register(person('08044444444', 'e@example.com'))
    await db.query(`update public.registrations set email_status = 'FAILED' where id = $1`, [failed.id])
    await db.query(`update public.registrations set created_at = now() - interval '11 minutes' where id = $1`, [stale.id])
    await db.query(`update public.registrations set email_status = 'FAILED', email_attempts = 5 where id = $1`, [exhausted.id])
    const rows = await rpc<{ id: string; details: Record<string, unknown> }>(`select * from public.email_retry_batch($1)`, [EVENT])
    expect(rows.map((r) => r.id).sort()).toEqual([failed.id, stale.id].sort())
    expect(rows.map((r) => r.id)).not.toContain(fresh.id)
    expect(rows.find((r) => r.id === failed.id)?.details).toMatchObject({ email: 'f@example.com', bringing_child: false })
  })

  it('a claimed retry row is not handed to an overlapping run', async () => {
    const r = await register(person('08011111111', 'f@example.com'))
    await db.query(`update public.registrations set email_status = 'FAILED' where id = $1`, [r.id])
    expect(await rpc(`select id from public.email_retry_batch($1)`, [EVENT])).toHaveLength(1)
    expect(await rpc(`select id from public.email_retry_batch($1)`, [EVENT])).toHaveLength(0)
    await db.query(`update public.registrations set retry_claimed_at = now() - interval '6 minutes' where id = $1`, [r.id])
    expect(await rpc(`select id from public.email_retry_batch($1)`, [EVENT])).toHaveLength(1)
  })

  it('Gmail daily limit: defers the retry without using up an attempt', async () => {
    const r = await register(person('08011111111', 'f@example.com'))
    await db.query('select public.set_email_status($1, $2, $3)', [r.id, 'FAILED', 60])
    const [row] = await rpc<{ email_attempts: number }>('select email_attempts from public.registrations where id = $1', [r.id])
    expect(row.email_attempts).toBe(0)
    expect(await rpc(`select id from public.email_retry_batch($1)`, [EVENT])).toHaveLength(0)
    const [{ s }] = await rpc<{ s: Record<string, number> }>(`select public.ops_summary($1) as s`, [EVENT])
    expect(s).toMatchObject({ failed: 1, deferred: 1 })
    await db.query(`update public.registrations set retry_not_before = now() - interval '1 minute' where id = $1`, [r.id])
    expect(await rpc(`select id from public.email_retry_batch($1)`, [EVENT])).toHaveLength(1)
    // A normal failure afterwards counts again and clears the deferral.
    await db.query('select public.set_email_status($1, $2)', [r.id, 'FAILED'])
    const [after] = await rpc<{ email_attempts: number; retry_not_before: Date | null }>(
      'select email_attempts, retry_not_before from public.registrations where id = $1', [r.id])
    expect(after).toEqual({ email_attempts: 1, retry_not_before: null })
  })
})

describe('001_init: Sheet mirror and ops', () => {
  it('returns unsynced rows shaped for the Sheet, then marks them synced', async () => {
    const r = await register(person('08012345678', 'funmi@example.com', { bringing_child: true }))
    const [row] = await rpc<Record<string, unknown>>(`select * from public.sheet_pending($1)`, [EVENT])
    expect(row).toMatchObject({ id: r.id, phone: '08012345678', years_married: 7, bringing_child: 'Yes', church: 'Citizens of Light Church' })
    expect(row.created_at).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
    const [marked] = await rpc<{ n: number }>('select public.sheet_mark_synced($1::uuid[]) as n', [[r.id]])
    expect(marked.n).toBe(1)
    expect(await rpc(`select * from public.sheet_pending($1)`, [EVENT])).toHaveLength(0)
  })

  it('ops_summary counts what the alerts and digest need', async () => {
    const a = await register(person('08011111111', 'a@example.com', { bringing_child: true }))
    const b = await register(person('08022222222', 'b@example.com'))
    await register(person('08033333333', 'c@example.com'))
    await db.query(`update public.registrations set email_status = 'FAILED', email_attempts = 5 where id = $1`, [a.id])
    await db.query(`update public.registrations set email_status = 'SENT', sheet_synced_at = now() where id = $1`, [b.id])
    await db.query(`update public.registrations set created_at = now() - interval '40 minutes' where id = $1`, [a.id])
    const [{ s }] = await rpc<{ s: Record<string, number> }>(`select public.ops_summary($1) as s`, [EVENT])
    expect(s).toMatchObject({ total: 3, bringing_child: 1, last_hour: 3, unsynced: 2, exhausted: 1, failed: 0, sent: 1, logged: 0 })
    expect(s.unsynced_oldest_minutes).toBeGreaterThanOrEqual(40)
  })

  it('rate limit: allows up to the limit per window, then refuses', async () => {
    const hit = async (key: string) => (await rpc<{ ok: boolean }>(`select public.rate_limit_hit($1, 3, 600) as ok`, [key]))[0].ok
    expect([await hit('k1'), await hit('k1'), await hit('k1'), await hit('k1')]).toEqual([true, true, true, false])
    expect(await hit('k2')).toBe(true)
  })
})

describe('002_occupation', () => {
  it('stores the occupation and returns it in the email details, and to the Sheet as the LAST column', async () => {
    const r = await register(person('08012345678', 'f@example.com', { occupation: 'Civil servant' }))
    const [row] = await rpc<{ occupation: string }>('select occupation from public.registrations where id = $1', [r.id])
    expect(row.occupation).toBe('Civil servant')
    const dup = await register(person('08012345678', 'x@example.com'))
    expect(dup.details).toMatchObject({ occupation: 'Civil servant' })
    const res = await db.query(`select * from public.sheet_pending($1)`, [EVENT])
    expect(res.fields.map((f) => f.name).at(-1)).toBe('occupation')
    expect(res.rows[0]).toMatchObject({ occupation: 'Civil servant' })
  })

  it('is live-safe: a payload without occupation (old code) saves an empty occupation', async () => {
    const { occupation: _omit, ...old } = person('08012345678', 'f@example.com')
    const r = await register(old)
    expect(r.status).toBe('created')
    const [row] = await rpc<{ occupation: string }>('select occupation from public.registrations where id = $1', [r.id])
    expect(row.occupation).toBe('')
  })

  it('keeps rows registered before the migration (occupation = empty)', async () => {
    await db.exec(sql('002_occupation.down.sql'))
    const before = await register(person('08012345678', 'f@example.com'))
    await db.exec(sql('002_occupation.sql'))
    const [row] = await rpc<{ occupation: string }>('select occupation from public.registrations where id = $1', [before.id])
    expect(row.occupation).toBe('')
  })

  it('rejects an occupation over 80 characters at the database level', async () => {
    await expect(register(person('08012345678', 'f@example.com', { occupation: 'x'.repeat(81) }))).rejects.toThrow(/check constraint/)
  })

  it('keeps the functions locked down, can be re-run, and rolls back to 001', async () => {
    for (const fn of ['public.register_attendee(text, jsonb)', 'public.sheet_pending(text, integer)', 'public.registration_details(public.registrations)']) {
      expect(await anonCanExecute(fn), fn).toBe(false)
    }
    await db.exec(sql('002_occupation.sql')) // idempotent
    await db.exec(sql('002_occupation.down.sql'))
    expect(await rpc(`select 1 from information_schema.columns where table_name = 'registrations' and column_name = 'occupation'`)).toHaveLength(0)
    const { occupation: _omit, ...old } = person('08012345678', 'f@example.com')
    expect((await register(old)).status).toBe('created')
    const res = await db.query(`select * from public.sheet_pending($1)`, [EVENT])
    expect(res.fields.map((f) => f.name).at(-1)).toBe('source')
    expect(await anonCanExecute('public.sheet_pending(text, integer)')).toBe(false)
  })
})

describe('003_menu', () => {
  const lookup = async (phone: string, email = '', event = EVENT) =>
    (await rpc<{ r: Record<string, any> }>('select public.menu_lookup($1, $2, $3) as r', [event, phone, email]))[0].r
  const choose = async (phone: string, item: string, email = '', event = EVENT) =>
    (await rpc<{ r: Record<string, any> }>('select public.choose_meal($1, $2, $3, $4) as r', [event, phone, email, item]))[0].r
  const remaining = async (item: string, event = EVENT) =>
    (await rpc<{ remaining: number }>('select remaining from public.menu_items where event = $1 and item_id = $2', [event, item]))[0].remaining

  it('seeds the 13 dishes (225 plates) for production and dev, in the listed order', async () => {
    const menu = await rpc<{ item_id: string; quantity: number; remaining: number }>(`select * from public.menu_status($1)`, [EVENT])
    expect(menu).toHaveLength(13)
    expect(menu[0].item_id).toBe('ofada-rice-sauce')
    expect(menu.at(-1)).toMatchObject({ item_id: 'pineapple-fried-rice', quantity: 10, remaining: 10 })
    expect(menu.reduce((n, m) => n + m.quantity, 0)).toBe(225)
    expect(await rpc(`select * from public.menu_status($1)`, [DEV])).toHaveLength(13)
  })

  it('allows choosing the additional Pineapple Fried Rice dish', async () => {
    await register(person('08012345678', 'funmi@example.com'))
    const r = await choose('08012345678', 'pineapple-fried-rice')
    expect(r).toMatchObject({ status: 'created', full_name: 'Funmilayo Adeyemi', choice: { item_id: 'pineapple-fried-rice', item_name: 'Pineapple Fried Rice' } })
    expect(r.choice.code).toMatch(/^[2-9A-HJKMNP-Z]{4}$/)
    expect(await remaining('pineapple-fried-rice')).toBe(9)
  })

  it('finds a registrant by phone or by email (case-insensitive), revealing only her name', async () => {
    await register(person('08012345678', 'funmi@example.com'))
    expect(await lookup('08012345678')).toEqual({ status: 'found', full_name: 'Funmilayo Adeyemi', choice: null })
    expect(await lookup('', 'FUNMI@example.com')).toMatchObject({ status: 'found', full_name: 'Funmilayo Adeyemi' })
    expect(await lookup('09099999999')).toEqual({ status: 'not_found' })
    expect(await lookup('', '')).toEqual({ status: 'not_found' })
    expect(await lookup('08012345678', '', DEV)).toEqual({ status: 'not_found' }) // events stay apart
  })

  it('takes one plate, records the choice with a code, and refuses a second choice', async () => {
    await register(person('08012345678', 'funmi@example.com'))
    const r = await choose('08012345678', 'fried-rice')
    expect(r).toMatchObject({ status: 'created', full_name: 'Funmilayo Adeyemi', choice: { item_id: 'fried-rice', item_name: 'Fried rice' } })
    expect(r.choice.code).toMatch(/^[2-9A-HJKMNP-Z]{4}$/)
    expect(await remaining('fried-rice')).toBe(9)
    // Coming back (even by email, even for another dish) shows the same choice and takes nothing.
    const again = await choose('', 'asun-rice', 'funmi@example.com')
    expect(again).toMatchObject({ status: 'already_chosen', choice: { item_id: 'fried-rice', code: r.choice.code } })
    expect(await remaining('asun-rice')).toBe(10)
    expect((await lookup('08012345678')).choice).toMatchObject({ item_name: 'Fried rice', code: r.choice.code })
  })

  it('refuses when a dish is finished, without recording anything', async () => {
    await db.query(`update public.menu_items set remaining = 1 where event = $1 and item_id = 'asun-rice'`, [EVENT])
    await register(person('08011111111', 'a@example.com'))
    await register(person('08022222222', 'b@example.com'))
    expect((await choose('08011111111', 'asun-rice')).status).toBe('created')
    expect(await choose('08022222222', 'asun-rice')).toEqual({ status: 'sold_out' })
    expect(await remaining('asun-rice')).toBe(0)
    expect((await lookup('08022222222')).choice).toBeNull() // she can still pick something else
    expect((await choose('08022222222', 'fried-rice')).status).toBe('created')
  })

  it('rejects unknown people and unknown dishes', async () => {
    await register(person('08012345678', 'funmi@example.com'))
    expect(await choose('09099999999', 'fried-rice')).toEqual({ status: 'not_found' })
    expect(await choose('08012345678', 'caviar')).toEqual({ status: 'unknown_item' })
  })

  it('a reset (deleting the choice) puts the plate back, as does deleting the registration', async () => {
    const a = await register(person('08011111111', 'a@example.com'))
    await register(person('08022222222', 'b@example.com'))
    await choose('08011111111', 'fried-rice')
    await choose('08022222222', 'fried-rice')
    expect(await remaining('fried-rice')).toBe(8)
    await db.query(`delete from public.meal_choices where registration_id = $1`, [a.id])
    expect(await remaining('fried-rice')).toBe(9)
    expect((await lookup('08011111111')).choice).toBeNull()
    await db.query(`delete from public.registrations where phone = '08022222222'`)
    expect(await remaining('fried-rice')).toBe(10)
  })

  it('lists choices for the Sheet (name, phone, dish, code)', async () => {
    await register(person('08012345678', 'funmi@example.com'))
    const r = await choose('08012345678', 'jollof-rice-chicken')
    const [row] = await rpc(`select * from public.meal_list($1)`, [EVENT])
    expect(row).toMatchObject({ full_name: 'Funmilayo Adeyemi', phone: '08012345678', dish: 'Jollof rice and chicken', code: r.choice.code })
  })

  it('is locked down and rolls back without touching registrations', async () => {
    for (const fn of ['public.menu_status(text)', 'public.menu_lookup(text, text, text)', 'public.choose_meal(text, text, text, text)', 'public.meal_list(text)', 'public.menu_find_registrant(text, text, text)']) {
      expect(await anonCanExecute(fn), fn).toBe(false)
    }
    const grants = await rpc(`select grantee from information_schema.role_table_grants where table_name in ('menu_items', 'meal_choices') and grantee in ('anon', 'authenticated')`)
    expect(grants).toHaveLength(0)
    const rls = await rpc<{ relrowsecurity: boolean }>(`select relrowsecurity from pg_class where relname in ('menu_items', 'meal_choices')`)
    expect(rls.every((r) => r.relrowsecurity)).toBe(true)
    await register(person('08012345678', 'funmi@example.com'))
    await db.exec(sql('005_pineapple_fried_rice.down.sql'))
    await db.exec(sql('004_table.down.sql'))
    await db.exec(sql('003_menu.down.sql'))
    expect(await rpc(`select 1 from pg_tables where tablename in ('menu_items', 'meal_choices')`)).toHaveLength(0)
    expect((await rpc<{ n: number }>('select count(*)::int as n from public.registrations'))[0].n).toBe(1)
  })
})

describe('004_table', () => {
  const choose5 = async (phone: string, item: string, table: string) =>
    (await rpc<{ r: Record<string, any> }>('select public.choose_meal($1, $2, $3, $4, $5) as r', [EVENT, phone, '', item, table]))[0].r
  const setTable = async (who: { phone?: string; email?: string }, table: string) =>
    (await rpc<{ r: Record<string, any> }>('select public.set_meal_table($1, $2, $3, $4) as r', [EVENT, who.phone ?? '', who.email ?? '', table]))[0].r

  it('saves the table number with the choice and shows it on the pass', async () => {
    await register(person('08012345678', 'funmi@example.com'))
    const r = await choose5('08012345678', 'fried-rice', '14')
    expect(r).toMatchObject({ status: 'created', choice: { item_name: 'Fried rice', table_no: '14' } })
  })

  it('requires a plain table number (1–999) and takes no plate otherwise', async () => {
    await register(person('08012345678', 'funmi@example.com'))
    for (const bad of ['', '0', '014', 'T3', '1000', '3 ']) {
      expect(await choose5('08012345678', 'fried-rice', bad), bad).toEqual({ status: 'invalid_table' })
    }
    const [{ remaining }] = await rpc<{ remaining: number }>(`select remaining from public.menu_items where event = $1 and item_id = 'fried-rice'`, [EVENT])
    expect(remaining).toBe(10)
  })

  it('is live-safe: the old 4-argument choose_meal still works (table left empty) and the table can be added later', async () => {
    await register(person('08012345678', 'funmi@example.com'))
    const old = (await rpc<{ r: Record<string, any> }>('select public.choose_meal($1, $2, $3, $4) as r', [EVENT, '08012345678', '', 'asun-rice']))[0].r
    expect(old).toMatchObject({ status: 'created', choice: { table_no: '' } })
    expect(await setTable({ email: 'FUNMI@example.com' }, '7')).toMatchObject({ status: 'updated', choice: { table_no: '7', item_name: 'Asun rice' } })
    expect(await setTable({ phone: '08012345678' }, '12')).toMatchObject({ status: 'updated', choice: { table_no: '12', item_name: 'Asun rice' } })
  })

  it('setting a table needs an existing choice, a known person and a valid number', async () => {
    await register(person('08012345678', 'funmi@example.com'))
    expect(await setTable({ phone: '08012345678' }, '3')).toEqual({ status: 'no_choice' })
    expect(await setTable({ phone: '09099999999' }, '3')).toEqual({ status: 'not_found' })
    expect(await setTable({ phone: '08012345678' }, 'x')).toEqual({ status: 'invalid_table' })
  })

  it('lists meals for the Sheet sorted by table (numerically), then name; no table last', async () => {
    await register(person('08011111111', 'a@example.com', { full_name: 'Bisi B' }))
    await register(person('08022222222', 'b@example.com', { full_name: 'Ada A' }))
    await register(person('08033333333', 'c@example.com', { full_name: 'Cee C' }))
    await register(person('08044444444', 'd@example.com', { full_name: 'Dee D' }))
    await choose5('08011111111', 'fried-rice', '10')
    await choose5('08022222222', 'fried-rice', '2')
    await choose5('08033333333', 'asun-rice', '10')
    await rpc('select public.choose_meal($1, $2, $3, $4)', [EVENT, '08044444444', '', 'asun-rice'])
    const rows = await rpc<{ table_no: string; full_name: string }>(`select table_no, full_name from public.meal_list($1)`, [EVENT])
    expect(rows.map((r) => `${r.table_no}:${r.full_name}`)).toEqual(['2:Ada A', '10:Bisi B', '10:Cee C', ':Dee D'])
  })

  it('is locked down and rolls back to 003 (choices kept)', async () => {
    for (const fn of ['public.choose_meal(text, text, text, text, text)', 'public.set_meal_table(text, text, text, text)', 'public.meal_list(text)']) {
      expect(await anonCanExecute(fn), fn).toBe(false)
    }
    await register(person('08012345678', 'funmi@example.com'))
    await choose5('08012345678', 'fried-rice', '5')
    await db.exec(sql('004_table.down.sql'))
    expect(await rpc(`select 1 from information_schema.columns where table_name = 'meal_choices' and column_name = 'table_no'`)).toHaveLength(0)
    expect(await rpc(`select * from public.meal_list($1)`, [EVENT])).toHaveLength(1)
    await db.exec(sql('004_table.sql')) // and forward again
  })
})

describe('001_init: lockdown', () => {
  it('locks tables and functions away from anon/authenticated, with RLS on', async () => {
    const grants = await rpc(
      `select grantee from information_schema.role_table_grants
        where table_name in ('registrations', 'rate_limits') and grantee in ('anon', 'authenticated')`)
    expect(grants).toHaveLength(0)
    for (const fn of [
      'public.register_attendee(text, jsonb)', 'public.set_email_status(uuid, text, integer)',
      'public.email_retry_batch(text, integer)', 'public.sheet_pending(text, integer)', 'public.sheet_mark_synced(uuid[])',
      'public.ops_summary(text)', 'public.rate_limit_hit(text, integer, integer)', 'public.registration_details(public.registrations)',
      'public.set_updated_at()',
    ]) {
      expect(await anonCanExecute(fn), fn).toBe(false)
    }
    const rls = await rpc<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relname in ('registrations', 'rate_limits') order by relname`)
    expect(rls).toEqual([{ relname: 'rate_limits', relrowsecurity: true }, { relname: 'registrations', relrowsecurity: true }])
  })

  it("revokes public EXECUTE on Supabase's rls_auto_enable helper when present (idempotent)", async () => {
    await db.exec(`create function public.rls_auto_enable() returns void language sql security definer as 'select'`)
    await db.exec(`grant execute on function public.rls_auto_enable() to anon, authenticated`)
    await db.exec(sql('005_pineapple_fried_rice.down.sql'))
    await db.exec(sql('003_menu.down.sql'))
    await db.exec(sql('001_init.down.sql'))
    await db.exec(sql('001_init.sql'))
    await db.exec(sql('002_occupation.sql'))
    await db.exec(sql('003_menu.sql'))
    await db.exec(sql('004_table.sql'))
    await db.exec(sql('005_pineapple_fried_rice.sql'))
    expect(await anonCanExecute('public.rls_auto_enable()')).toBe(false)
    await db.exec('drop function public.rls_auto_enable()')
  })

  it('rolls back cleanly', async () => {
    await db.exec(sql('005_pineapple_fried_rice.down.sql'))
    await db.exec(sql('004_table.down.sql'))
    await db.exec(sql('003_menu.down.sql'))
    await db.exec(sql('002_occupation.down.sql'))
    await db.exec(sql('001_init.down.sql'))
    const [{ n }] = await rpc<{ n: number }>(
      `select count(*)::int as n from pg_tables where tablename in ('registrations', 'rate_limits')`)
    expect(n).toBe(0)
    expect(await rpc(`select 1 from pg_proc where proname = 'register_attendee'`)).toHaveLength(0)
  })
})
