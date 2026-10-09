/** The flyer's four-point sparkle (inside the O of HANGOUT): the page's recurring motif. */
export function Sparkle({ className = '', size = 20 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
      <path d="M12 0c.6 6.6 5.4 11.4 12 12-6.6.6-11.4 5.4-12 12-.6-6.6-5.4-11.4-12-12C6.6 11.4 11.4 6.6 12 0Z" />
    </svg>
  )
}

/** Thin rule, sparkle, thin rule. */
export function SparkleRule({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center justify-center gap-3 ${className}`}>
      <span className="h-[var(--rule)] w-14 bg-current opacity-50" />
      <Sparkle size={14} />
      <span className="h-[var(--rule)] w-14 bg-current opacity-50" />
    </div>
  )
}
