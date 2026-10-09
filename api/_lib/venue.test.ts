import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { VENUE } from './venue.js'
import { EVENT } from '../../shared/event.js'

// Pastor's request (2026-10-09): the venue is revealed only after registering. shared/ and src/ are
// compiled into the public page, so the venue must live only in api/_lib/venue.ts.
describe('venue stays private until registration', () => {
  it('is not in the shared event facts', () => {
    expect(JSON.stringify(EVENT)).not.toContain('Freedom')
    expect(JSON.stringify(EVENT)).not.toContain(VENUE)
  })

  it('is not in any page source or the page HTML templates', () => {
    for (const file of ['index.html', 'privacy.html', 'shared/event.ts', 'src/components/Hero.tsx', 'src/components/SuccessScreen.tsx', 'src/App.tsx']) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('Freedom')
    }
  })

  it('uses the corrected time', () => {
    expect(EVENT.time).toBe('4:00 PM')
    expect(EVENT.schedule.start).toBe('2026-10-24T16:00:00+01:00')
  })
})
