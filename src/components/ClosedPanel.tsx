import { CalendarClock, CircleCheck } from 'lucide-react'
import { EVENT } from '../../shared/event'
import { Ornament } from './Ornament'

type Props = { state: 'not_open' | 'closed' }

/** Replaces the form outside the registration window. */
export function ClosedPanel({ state }: Props) {
  const Icon = state === 'closed' ? CircleCheck : CalendarClock
  return (
    <div role="status" className="rounded-lg bg-wine px-5 py-7 text-center text-ivory shadow-card">
      <Icon aria-hidden size={32} strokeWidth={1.5} className="mx-auto text-gold" />
      <h2 className="mt-3 font-display text-h1 font-semibold italic">
        {state === 'closed' ? 'Registration is closed' : 'Registration opens soon'}
      </h2>
      <Ornament className="mt-4 text-gold" />
      <p className="mt-4 font-text text-lead">
        {state === 'closed' ? `Thank you! See you at ${EVENT.name}.` : 'Check back shortly to register.'}
      </p>
    </div>
  )
}
