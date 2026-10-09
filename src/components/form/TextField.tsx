import { useId, type InputHTMLAttributes } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { controlClass, describedBy } from './field-utils'
import { FieldShell } from './FieldShell'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string
  registration: UseFormRegisterReturn
}

export function TextField({ label, hint, error, registration, className, ...input }: Props) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        {...input}
        {...registration}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={controlClass(!!error)}
      />
    </FieldShell>
  )
}
