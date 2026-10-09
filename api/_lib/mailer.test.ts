import { describe, expect, it } from 'vitest'
import { isDailyLimitError } from './mailer.js'

describe('isDailyLimitError', () => {
  it("recognises Gmail's daily sending limit", () => {
    expect(isDailyLimitError({ responseCode: 550, response: '550-5.4.5 Daily user sending limit exceeded. For more information…' })).toBe(true)
    expect(isDailyLimitError(new Error('Message failed: 550 5.4.5 Daily user sending quota exceeded.'))).toBe(true)
  })

  it('does not treat other failures as the daily limit', () => {
    expect(isDailyLimitError({ responseCode: 535, response: '535-5.7.8 Username and Password not accepted' })).toBe(false)
    expect(isDailyLimitError(new Error('Connection timeout'))).toBe(false)
    expect(isDailyLimitError(undefined)).toBe(false)
  })
})
