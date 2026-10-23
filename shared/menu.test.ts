import { describe, expect, it } from 'vitest'
import { parseWho } from './menu.js'

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
