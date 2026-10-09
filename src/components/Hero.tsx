import { CalendarDays } from 'lucide-react'
import { EVENT } from '../../shared/event'

/** The flyer, made tappable: sky, logo, title lettering, theme band, the five women, then the date and time.
 *  No venue: it is revealed only after registering (Pastor's request). */
export function Hero({ onRegister }: { onRegister?: () => void }) {
  return (
    <header>
      <div className="bg-sky-gradient">
        <div className="mx-auto max-w-[640px] px-4 pt-6 text-center">
          <picture className="mx-auto block w-12">
            <source srcSet="/assets/clc-logo-white.webp" type="image/webp" />
            <img src="/assets/clc-logo-white.png" alt={EVENT.host} width={160} height={204} className="h-auto w-full" />
          </picture>
          <h1 className="mx-auto mt-5 w-[min(86%,400px)]">
            <picture>
              <source srcSet="/assets/title.webp" type="image/webp" />
              <img src="/assets/title.png" alt={EVENT.name} width={640} height={299} fetchPriority="high" className="h-auto w-full" />
            </picture>
          </h1>
          {/* The sky ends at this band, exactly where the photo's backdrop begins: no seam. */}
          <p className="relative z-10 mx-auto mt-6 w-fit bg-burgundy px-3 py-2 text-center font-caps text-band font-semibold uppercase text-white">
            {EVENT.theme}
          </p>
        </div>
      </div>
      <div className="bg-photo-blend -mt-5">
        <picture className="photo-mask mx-auto block max-w-[640px]">
          <source type="image/webp" srcSet="/assets/hero-720.webp 720w, /assets/hero-1280.webp 1280w" sizes="(min-width: 640px) 640px, 100vw" />
          <img
            src="/assets/hero-720.jpg"
            srcSet="/assets/hero-720.jpg 720w, /assets/hero-1280.jpg 1280w"
            sizes="(min-width: 640px) 640px, 100vw"
            alt="Five smiling women laughing together"
            width={1280}
            height={608}
            className="h-auto w-full"
          />
        </picture>
      </div>

      <div className="bg-wine px-4 pb-9 pt-2 text-center text-white">
        <div className="mx-auto max-w-[440px]">
          <p className="flex items-center justify-center gap-2 font-text text-lead font-semibold uppercase tracking-[0.04em]">
            <CalendarDays aria-hidden size={20} strokeWidth={2} className="shrink-0 text-rose" />
            {EVENT.date.replace('Saturday, ', 'Sat ')} · {EVENT.time}
          </p>
          {onRegister && (
            <a
              href="#register"
              onClick={(e) => {
                e.preventDefault()
                onRegister()
              }}
              className="mt-6 inline-flex min-h-[52px] items-center justify-center rounded-pill bg-white px-8 font-caps text-button font-semibold uppercase text-burgundy transition-colors duration-[var(--dur-fast)] hover:bg-petal focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white"
            >
              Register free
            </a>
          )}
        </div>
      </div>
    </header>
  )
}

/** Slim header for the result screens: sky strip, logo and title lettering. */
export function CompactHero() {
  return (
    <div className="bg-sky-gradient px-4 pb-6 pt-5 text-center">
      <picture className="mx-auto block w-9">
        <source srcSet="/assets/clc-logo-white.webp" type="image/webp" />
        <img src="/assets/clc-logo-white.png" alt={EVENT.host} width={160} height={204} className="h-auto w-full" />
      </picture>
      <picture className="mx-auto mt-3 block w-[min(60%,260px)]">
        <source srcSet="/assets/title.webp" type="image/webp" />
        <img src="/assets/title.png" alt={EVENT.name} width={640} height={299} className="h-auto w-full" />
      </picture>
    </div>
  )
}
