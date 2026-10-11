import { CalendarDays, MailCheck, MapPin } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { EVENT, yearsMarriedLabel } from '../../shared/event'
import { churchLabel, heardLabel, toPayload, type Registration } from '../../shared/registration'
import { Button } from './Button'
import { CompactHero } from './Hero'
import { Sparkle } from './Sparkle'

/** "You're registered!" plus a summary of exactly what was submitted. The sparkle is the page's one signature moment. */
/** `venue` comes from /api/register's success reply: it is not in the public page. */
export function SuccessScreen({ values, venue, onBack }: { values: Registration; venue: string; onBack: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [])
  const d = toPayload(values)
  const firstName = d.full_name.split(/\s+/)[0]
  const rows: [string, string][] = [
    ['Full name', d.full_name],
    ['Years married', yearsMarriedLabel(d.years_married)],
    ['Occupation', d.occupation],
    ['Phone (WhatsApp)', d.phone],
    ['Email', d.email],
    ['Church', churchLabel(d)],
    ['How you heard', heardLabel(d)],
    ['Bringing a child', d.bringing_child ? 'Yes' : 'No'],
  ]

  return (
    <main className="min-h-dvh pb-12">
      <CompactHero />
      <section className="mx-auto max-w-[440px] px-4">
        <div className="-mt-3 rounded-lg bg-white px-5 pb-6 pt-7 text-center shadow-card">
          <Sparkle size={40} className="mx-auto animate-sparkle-in text-magenta" />
          <h1 ref={headingRef} tabIndex={-1} className="mt-3 font-display text-h1 font-semibold text-burgundy outline-none">
            You're registered!
          </h1>
          <p className="mt-2 font-text text-lead text-ink">Thank you, {firstName}. We can't wait to see you.</p>
          <p className="mt-4 flex items-start gap-2.5 rounded-md bg-petal px-4 py-3 text-left font-text text-small text-ink">
            <MailCheck aria-hidden size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-magenta-700" />
            <span>
              We've emailed a copy to <b className="font-semibold [overflow-wrap:anywhere]">{d.email}</b>. Check your inbox (and your spam folder).
            </span>
          </p>
        </div>

        <div className="mt-5 animate-rise-in rounded-lg bg-white px-5 py-4 shadow-card">
          <h3 className="font-caps text-eyebrow font-semibold uppercase text-magenta-700">Your registration</h3>
          <dl className="mt-1">
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[42%_1fr] gap-3 border-b border-petal py-2.5 last:border-0">
                <dt className="font-text text-small text-muted">{label}</dt>
                <dd className="min-w-0 font-text text-small font-semibold text-ink [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-5 rounded-lg bg-wine px-5 py-5 text-center text-white">
          <p className="font-caps text-eyebrow font-semibold uppercase text-rose">{EVENT.theme}</p>
          <p className="mt-2 flex items-center justify-center gap-2 font-text text-body font-semibold">
            <CalendarDays aria-hidden size={18} strokeWidth={2} className="shrink-0 text-rose" />
            <span>
              {EVENT.date.replace('Saturday, ', 'Sat ')} · <span className="whitespace-nowrap">{EVENT.time}</span>
            </span>
          </p>
          <p className="mt-3 font-caps text-eyebrow font-semibold uppercase text-rose">Venue</p>
          <p className="mt-1 flex items-start justify-center gap-2 font-text text-body">
            <MapPin aria-hidden size={18} strokeWidth={2} className="mt-1 shrink-0 text-rose" />
            <span>{venue || 'The venue is in your confirmation email.'}</span>
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
