import { useEffect, useRef, type ReactNode } from 'react'

/** Minimal accessible modal: overlay, focus moved inside, Escape closes (when allowed). */
export function Modal({ label, onClose, children }: { label: string; onClose?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4 py-6">
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className="reveal max-h-full w-full max-w-[420px] overflow-y-auto rounded-lg bg-white shadow-card">
        {children}
      </div>
    </div>
  )
}
