import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'light'
  loading?: boolean
}

const VARIANTS = {
  primary: 'bg-burgundy text-white hover:bg-wine',
  secondary: 'border-[length:var(--border-field)] border-burgundy bg-white text-burgundy hover:bg-petal',
  light: 'bg-white text-burgundy hover:bg-petal',
}

/** Pill button in the flyer's condensed caps. One primary per screen. */
export function Button({ variant = 'primary', loading = false, className = '', children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={
        'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-pill px-7 py-3 ' +
        'font-caps text-button font-semibold uppercase ' +
        'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] ' +
        'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-magenta ' +
        'disabled:cursor-not-allowed disabled:opacity-70 ' +
        VARIANTS[variant] + ' ' + className
      }
    >
      {loading && <LoaderCircle aria-hidden size={20} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  )
}
