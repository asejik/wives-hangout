import { EVENT } from '../shared/event'
import { ClosedPanel } from './components/ClosedPanel'
import { Hero } from './components/Hero'

// M0 placeholder: the form and the /api/status-driven screens arrive in M2.
export default function App() {
  return (
    <main>
      <Hero />
      <section aria-label="Registration" className="mx-auto max-w-[440px] px-4 pb-10">
        <ClosedPanel state="not_open" />
      </section>
      <footer className="mx-auto max-w-[440px] px-4 pb-10 text-center font-text text-small text-muted">
        <p>
          Questions? Email{' '}
          <a href={`mailto:${EVENT.contactEmail}`} className="font-semibold text-wine underline underline-offset-2">
            {EVENT.contactEmail}
          </a>
        </p>
        <p className="mt-1">{EVENT.host}</p>
      </footer>
    </main>
  )
}
