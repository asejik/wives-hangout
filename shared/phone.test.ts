import { describe, expect, it } from 'vitest'
import { normalizeNigerianPhone } from './phone.js'

describe('normalizeNigerianPhone', () => {
  it.each([
    ['08012345678', '08012345678'],
    ['0801 234 5678', '08012345678'],
    ['0801-234-5678', '08012345678'],
    ['+2348012345678', '08012345678'],
    ['+234 801 234 5678', '08012345678'],
    ['2348012345678', '08012345678'],
    ['8012345678', '08012345678'],
    ['(0703) 123 4567', '07031234567'],
    ['09012345678', '09012345678'],
    ['  08112345678  ', '08112345678'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeNigerianPhone(input)).toBe(expected)
  })

  it.each([
    [''],
    ['0801234567'], // 10 digits with leading 0
    ['080123456789'], // 12 digits
    ['+2340801234567'], // +234 followed by a leading 0
    ['02012345678'], // landline range
    ['08512345678'], // not a mobile range
    ['0801234567a'],
    ['+44 7911 123456'],
  ])('rejects %s', (input) => {
    expect(normalizeNigerianPhone(input)).toBeNull()
  })
})
