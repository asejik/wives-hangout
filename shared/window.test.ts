import { describe, expect, it } from 'vitest'
import { parseWindowTime, registrationWindow } from './window.js'

const opens = '2026-10-13T08:00:00+01:00'
const closes = '2026-10-25T12:00:00+01:00'

describe('registrationWindow', () => {
  it('is open with no bounds set', () => {
    expect(registrationWindow(new Date('2026-10-20T00:00:00Z'))).toBe('open')
  })
  it('is not_open before the opening time, open between, closed at and after closing', () => {
    expect(registrationWindow(new Date('2026-10-13T06:59:59Z'), opens, closes)).toBe('not_open')
    expect(registrationWindow(new Date('2026-10-13T07:00:00Z'), opens, closes)).toBe('open')
    expect(registrationWindow(new Date('2026-10-25T10:59:59Z'), opens, closes)).toBe('open')
    expect(registrationWindow(new Date('2026-10-25T11:00:00Z'), opens, closes)).toBe('closed') // 12:00 WAT
  })
  it('rejects times without an explicit offset', () => {
    expect(parseWindowTime('2026-10-25T12:00:00')).toBe('invalid')
    expect(parseWindowTime('soon')).toBe('invalid')
    expect(() => registrationWindow(new Date(), undefined, '2026-10-25 12:00')).toThrow()
  })
})
