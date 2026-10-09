export function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined
}

export const controlClass = (invalid: boolean) =>
  'block min-h-[52px] w-full rounded-md bg-white px-4 py-3 font-text text-body text-ink ' +
  'border-[length:var(--border-field)] border-muted outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ' +
  'placeholder:text-muted/80 focus:border-magenta focus:shadow-focus ' +
  (invalid ? '!border-error' : '')

export const labelClass = 'mb-2 block font-text text-label font-semibold text-ink'
