import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { EVENT } from '../../shared/event'
import { Ornament } from './Ornament'

const details = [
  { Icon: CalendarDays, text: EVENT.date },
  { Icon: Clock, text: EVENT.time },
  { Icon: MapPin, text: EVENT.venue },
] as const

/** First screen: church logo, title and the event facts. */
export function Hero() {
  return (
    <header className="mx-auto max-w-[440px] px-4 pb-8 pt-8 text-center">
      <img src="/assets/clc-logo.webp" alt={EVENT.host} width={66} height={84} className="mx-auto h-[84px] w-auto" />
      <p className="mt-8 font-text text-eyebrow font-semibold uppercase text-gold-700">You're invited to</p>
      <h1 className="mt-3 font-display text-display font-semibold italic text-wine">{EVENT.name}</h1>
      <Ornament className="mt-5 text-gold-700" />
      <ul className="mt-6 space-y-3 text-left">
        {details.map(({ Icon, text }) => (
          <li key={text} className="flex items-start gap-3 font-text text-body text-ink">
            <Icon aria-hidden size={20} strokeWidth={1.75} className="mt-[3px] shrink-0 text-wine" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </header>
  )
}
