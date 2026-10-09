/** Thin gold rule with a centred diamond: the page's recurring motif (temporary theme). */
export function Ornament({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center justify-center gap-3 ${className}`}>
      <span className="h-[var(--rule)] w-16 bg-current opacity-60" />
      <span className="size-2 rotate-45 border-[length:var(--rule)] border-current" />
      <span className="h-[var(--rule)] w-16 bg-current opacity-60" />
    </div>
  )
}
