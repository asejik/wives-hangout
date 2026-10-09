import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { labelClass } from './field-utils'

type Props = {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

/** Label above, control, then a hint or an error (linked via aria-describedby on the control). */
export function FieldShell({ id, label, hint, error, children, className = '' }: Props) {
  return (
    <div className={`mb-5 ${className}`}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? <FieldError id={`${id}-error`} message={error} /> : hint ? <Hint id={`${id}-hint`} text={hint} /> : null}
    </div>
  )
}

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} role="alert" className="reveal mt-2 flex items-center gap-1.5 font-text text-small font-semibold text-error">
      <CircleAlert aria-hidden size={16} strokeWidth={2.5} className="shrink-0" />
      {message}
    </p>
  )
}

function Hint({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="mt-2 font-text text-small text-muted">
      {text}
    </p>
  )
}
