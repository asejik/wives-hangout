import { describe, expect, it } from 'vitest'
import { EVENT } from './event.js'
import { parseSeat, parseWho } from './menu.js'

describe('parseWho', () => {
  it('reads a Nigerian phone number in any common format', () => {
    expect(parseWho('0801 234 5678')).toEqual({ phone: '08012345678', email: '' })
    expect(parseWho('+234 801 234 5678')).toEqual({ phone: '08012345678', email: '' })
  })
  it('reads an email, lower-cased', () => {
    expect(parseWho('  Funmi@Example.COM ')).toEqual({ phone: '', email: 'funmi@example.com' })
  })
  it('rejects anything else', () => {
    for (const bad of ['', '123', 'funmi@', 'Funmilayo', 42, null]) expect(parseWho(bad)).toBeNull()
  })
})

describe('menu closing time', () => {
  it('the label on the page matches the time the server enforces (Lagos time)', () => {
    const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', ...opts }).format(new Date(EVENT.menuClosesAt))
    expect(EVENT.menuClosesLabel).toContain(fmt({ hour: 'numeric', minute: '2-digit' })) // "8:00 PM"
    expect(EVENT.menuClosesLabel).toContain(`${fmt({ day: 'numeric' })} ${fmt({ month: 'short' })}`) // "24 Oct"
  })
})

describe('parseSeat', () => {
  it('accepts seat numbers and short labels, tidied', () => {
    expect(parseSeat('1')).toBe('1')
    expect(parseSeat(' 14 ')).toBe('14')
    expect(parseSeat(14)).toBe('14')
    expect(parseSeat('b12')).toBe('B12')
    expect(parseSeat('B-12')).toBe('B12')
    expect(parseSeat('12 a')).toBe('12A')
  })
  it('rejects anything else', () => {
    for (const bad of ['', '  ', 'B', 'VIP', 'Seat 1234', '1.5', '#3', null, undefined]) expect(parseSeat(bad)).toBeNull()
  })
})
