import { useId, type ReactNode } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { FieldError } from './FieldShell'
import { labelClass } from './field-utils'

type Props = {
  legend: ReactNode
  options: readonly string[]
  /** 'row' for short answers side by side (No / Yes); 'stack' for longer ones. */
  layout?: 'row' | 'stack'
  error?: string
  registration: UseFormRegisterReturn
}

/** Radio group drawn as large tappable cards (≥ 52px); the selected one turns magenta. */
export function ChoiceField({ legend, options, layout = 'row', error, registration }: Props) {
  const id = useId()
  return (
    <fieldset className="mb-5" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className={labelClass}>{legend}</legend>
      <div className={layout === 'row' ? 'grid grid-cols-2 gap-2.5' : 'grid gap-2.5'}>
        {options.map((o) => (
          <label key={o} className="relative block">
            <input type="radio" value={o} {...registration} className="peer sr-only" />
            <span
              className={
                'flex min-h-[52px] cursor-pointer items-center gap-3 rounded-md border-[length:var(--border-field)] border-muted bg-white px-4 py-3 ' +
                'font-text text-body font-medium text-ink transition-colors duration-[var(--dur-fast)] ' +
                'peer-checked:border-magenta peer-checked:bg-petal peer-checked:[&>.dot]:border-magenta peer-checked:[&>.dot]:bg-magenta ' +
                'peer-focus-visible:border-magenta peer-focus-visible:shadow-focus ' +
                (error ? '!border-error' : '')
              }
            >
              <span aria-hidden className="dot size-5 shrink-0 rounded-full border-[length:var(--border-field)] border-muted bg-white shadow-[inset_0_0_0_3px_var(--color-white)]" />
              {o}
            </span>
          </label>
        ))}
      </div>
      {error && <FieldError id={`${id}-error`} message={error} />}
    </fieldset>
  )
}
