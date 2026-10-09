import { ChevronDown } from 'lucide-react'
import { useId } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { controlClass, describedBy } from './field-utils'
import { FieldShell } from './FieldShell'

type Props = {
  label: string
  options: readonly string[]
  placeholder: string
  error?: string
  registration: UseFormRegisterReturn
}

/** Native select: works in every in-app browser. The form defaults it to '' so the placeholder shows. */
export function SelectField({ label, options, placeholder, error, registration }: Props) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error}>
      <div className="relative">
        <select
          id={id}
          {...registration}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error)}
          className={`${controlClass(!!error)} appearance-none pr-12`}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden size={22} strokeWidth={2} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-burgundy" />
      </div>
    </FieldShell>
  )
}
