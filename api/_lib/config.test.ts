import { describe, expect, it } from 'vitest'
import { configProblem, scrub } from './config.js'

const ok = { SUPABASE_URL: 'u', SUPABASE_SECRET_KEY: 'k', EVENT_SLUG: 'wives-hangout-2026-dev', EMAIL_MODE: 'log' }

describe('configProblem', () => {
  it('accepts a complete preview/dev config', () => {
    expect(configProblem(ok)).toBeNull()
  })
  it('names missing variables', () => {
    expect(configProblem({ ...ok, SUPABASE_URL: '' })).toBe('missing env: SUPABASE_URL')
  })
  it('rejects a slug the database would refuse', () => {
    expect(configProblem({ ...ok, EVENT_SLUG: 'Wives Hangout 2026' })).toMatch(/EVENT_SLUG/)
  })
  it('rejects log mode in production (P03-03)', () => {
    const prod = { ...ok, VERCEL_ENV: 'production', EVENT_SLUG: 'wives-hangout-2026' }
    expect(configProblem(prod)).toBe('EMAIL_MODE must be smtp in production')
    expect(configProblem({ ...prod, EMAIL_MODE: 'smtp' })).toBeNull()
    expect(configProblem({ ...ok, VERCEL_ENV: 'preview' })).toBeNull()
  })
  it('keeps dev and production slugs apart (one shared database)', () => {
    expect(configProblem({ ...ok, VERCEL_ENV: 'production', EMAIL_MODE: 'smtp' })).toMatch(/must not end in -dev/)
    expect(configProblem({ ...ok, EVENT_SLUG: 'wives-hangout-2026' })).toMatch(/must end in -dev/)
    expect(configProblem({ ...ok, VERCEL_ENV: 'preview', EVENT_SLUG: 'wives-hangout-2026' })).toMatch(/must end in -dev/)
  })
  it('rejects window times without an offset', () => {
    expect(configProblem({ ...ok, REGISTRATION_CLOSES_AT: '2026-10-25T12:00' })).toMatch(/REGISTRATION_CLOSES_AT/)
    expect(configProblem({ ...ok, REGISTRATION_CLOSES_AT: '2026-10-25T12:00:00+01:00' })).toBeNull()
  })

  it('rejects unknown email modes', () => {
    expect(configProblem({ ...ok, EMAIL_MODE: 'SMTP ' })).toMatch(/EMAIL_MODE/)
  })
})

describe('scrub', () => {
  it('removes email addresses from error text', () => {
    expect(scrub('550 5.1.1 <tolu.a+x@gmail.com>: user unknown')).toBe('550 5.1.1 <[email]>: user unknown')
    expect(scrub('Invalid login: 535-5.7.8')).toBe('Invalid login: 535-5.7.8')
  })
})
