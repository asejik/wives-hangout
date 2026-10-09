import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONFIRMATION_HTML } from '../api/_lib/email-template'
import { renderTemplate, templateModule } from '../scripts/build-email'

describe('emails/Confirmation.tsx', () => {
  it('matches the committed api/_lib/email-template.ts (run `npm run email:build` if this fails)', async () => {
    const committed = readFileSync(new URL('../api/_lib/email-template.ts', import.meta.url), 'utf8')
    expect(committed).toBe(templateModule(await renderTemplate()))
  })

  it('keeps the display font off body text', () => {
    expect(CONFIRMATION_HTML).not.toMatch(/\*\s*\{[^}]*font-family/)
    expect(CONFIRMATION_HTML).toContain("font-family:'Cormorant Garamond'")
  })

  it('has no responsive variants (React Email inlines them unconditionally)', () => {
    expect(CONFIRMATION_HTML).not.toMatch(/@media/)
  })
})
