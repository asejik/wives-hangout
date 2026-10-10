import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { VENUE } from './venue.js'
import { EVENT } from '../../shared/event.js'

// Pastor's request (2026-10-09): the venue is revealed only after registering. shared/ and src/ are
// compiled into the public page, so the venue must live only in api/_lib/venue.ts.
// Distinctive words of the current and the earlier venue (scripts/smoke.mjs checks the same words live).
const PRIVATE_WORDS = ['Ojomu', 'Luxury Hotel', 'Basin Road', 'Freedom']

describe('venue stays private until registration', () => {
  it('the word list matches the current venue', () => {
    expect(PRIVATE_WORDS.some((w) => VENUE.includes(w))).toBe(true)
  })

  it('is not in the shared event facts', () => {
    for (const word of PRIVATE_WORDS) expect(JSON.stringify(EVENT)).not.toContain(word)
    expect(JSON.stringify(EVENT)).not.toContain(VENUE)
  })

  it('is not in any page source or the page HTML templates', () => {
    for (const file of ['index.html', 'privacy.html', 'shared/event.ts', 'src/components/Hero.tsx', 'src/components/SuccessScreen.tsx', 'src/App.tsx']) {
      for (const word of PRIVATE_WORDS) expect(readFileSync(file, 'utf8'), file).not.toContain(word)
    }
  })

  it('uses the corrected time', () => {
    expect(EVENT.time).toBe('4:00 PM')
    expect(EVENT.schedule.start).toBe('2026-10-24T16:00:00+01:00')
  })
})
