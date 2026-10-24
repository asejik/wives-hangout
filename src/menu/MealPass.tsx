import { Camera } from 'lucide-react'
import { EVENT } from '../../shared/event'
import type { MealChoice } from '../../shared/menu'
import { Sparkle } from '../components/Sparkle'

/** The screenshot card: her name, the dish, a code the server checks against the Sheet. */
export function MealPass({ fullName, choice }: { fullName: string; choice: MealChoice }) {
  return (
    <div className="overflow-hidden rounded-lg border-[length:var(--border-field)] border-burgundy bg-white text-center">
      <div className="bg-burgundy px-4 py-3 text-white">
        <p className="font-caps text-eyebrow font-semibold uppercase text-rose">{EVENT.name} · Meal</p>
      </div>
      <div className="px-5 pb-5 pt-4">
        <Sparkle size={28} className="mx-auto animate-sparkle-in text-magenta" />
        <p className="mt-2 font-text text-body font-semibold text-ink [overflow-wrap:anywhere]">{fullName}</p>
        <p className="mt-3 font-caps text-eyebrow font-semibold uppercase text-muted">Table</p>
        <p className={`font-caps font-semibold ${choice.table_no ? 'text-h1 text-burgundy' : 'text-body text-error'}`}>
          {choice.table_no || 'Not given yet'}
        </p>
        <p className="mt-3 font-caps text-eyebrow font-semibold uppercase text-muted">Your meal</p>
        <p className="mt-1 font-display text-h2 font-semibold text-burgundy">{choice.item_name}</p>
        <p className="mt-4 font-caps text-eyebrow font-semibold uppercase text-muted">Code</p>
        <p className="font-caps text-h1 font-semibold tracking-[0.2em] text-ink" aria-label={`Code ${choice.code.split('').join(' ')}`}>
          {choice.code}
        </p>
        <p className="mt-2 font-text text-small text-muted">Chosen {choice.chosen_at}</p>
      </div>
      <p className="flex items-start gap-2.5 bg-petal px-4 py-3 text-left font-text text-small font-semibold text-ink">
        <Camera aria-hidden size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-magenta-700" />
        <span>Take a screenshot now and show it to the server at your table.</span>
      </p>
    </div>
  )
}
