import { MailCheck } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { EVENT } from '../../shared/event'
import { Button } from './Button'
import { CompactHero } from './Hero'

/** Already registered: never shows stored details (they're only re-sent to the email on file). */
export function DuplicateNotice({ onBack }: { onBack: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [])

  return (
    <main className="min-h-dvh pb-12">
      <CompactHero />
      <section className="mx-auto max-w-[440px] px-4">
        <div className="-mt-3 rounded-lg bg-white px-5 pb-6 pt-7 text-center shadow-card">
          <MailCheck aria-hidden size={36} strokeWidth={1.75} className="mx-auto text-magenta" />
          <h1 ref={headingRef} tabIndex={-1} className="mt-3 font-display text-h2 font-semibold text-burgundy outline-none">
            You're already registered
          </h1>
          <p className="mt-3 font-text text-body text-ink">
            That phone number or email has already been used to register. We've sent your details again to the email address
            you registered with. Check your inbox (and your spam folder).
          </p>
          <p className="mt-3 font-text text-small text-muted">
            Nothing arrived? Wait 10 minutes and try again, or email{' '}
            <a href={`mailto:${EVENT.contactEmail}`} className="font-semibold text-magenta-700 underline underline-offset-2">
              {EVENT.contactEmail}
            </a>
            .
          </p>
        </div>
        <div className="mt-7 flex justify-center">
          <Button variant="secondary" onClick={onBack}>
            ← Back to home
          </Button>
        </div>
      </section>
    </main>
  )
}
