import { CalendarClock, CircleCheck } from 'lucide-react'
import { EVENT } from '../../shared/event'
import { SparkleRule } from './Sparkle'

type Props = { state: 'not_open' | 'closed'; opensAt?: string | null }

function formatOpening(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
  })
}

/** Replaces the form outside the registration window. */
export function ClosedPanel({ state, opensAt }: Props) {
  const Icon = state === 'closed' ? CircleCheck : CalendarClock
  return (
    <div role="status" className="rounded-lg bg-wine px-5 py-7 text-center text-white shadow-card">
      <Icon aria-hidden size={32} strokeWidth={1.75} className="mx-auto text-rose" />
      <h2 className="mt-3 font-display text-h2 font-semibold">
        {state === 'closed' ? 'Registration is closed' : 'Registration opens soon'}
      </h2>
      <SparkleRule className="mt-3 text-rose" />
      <p className="mt-3 font-text text-body">
        {state === 'closed'
          ? `Thank you! See you at ${EVENT.name}.`
          : opensAt
            ? `Come back on ${formatOpening(opensAt)} to register.`
            : 'Check back shortly to register.'}
      </p>
    </div>
  )
}
