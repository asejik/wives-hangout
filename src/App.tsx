import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { EVENT } from '../shared/event'
import { ClosedPanel } from './components/ClosedPanel'
import { DuplicateNotice } from './components/DuplicateNotice'
import { Hero } from './components/Hero'
import type { Done } from './components/RegistrationForm'
import { Sparkle } from './components/Sparkle'
import { SuccessScreen } from './components/SuccessScreen'

// The form (react-hook-form + zod) loads after the hero has painted.
const RegistrationForm = lazy(() => import('./components/RegistrationForm').then((m) => ({ default: m.RegistrationForm })))

type Status = { state: 'loading' | 'open' | 'not_open' | 'closed'; opensAt?: string | null }

export default function App() {
  const [done, setDone] = useState<Done | null>(null)
  // The prerendered HTML and the first client render both show the placeholder (hydration matches);
  // the lazy form mounts only after hydration, so React never tries to server-render it (error #419).
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const [status, setStatus] = useState<Status>({ state: 'loading' })

  // Which screen to show (open / opens soon / closed). If the check fails, show the form:
  // the server still enforces the window.
  useEffect(() => {
    let live = true
    fetch('/api/status', { signal: AbortSignal.timeout(8_000) })
      .then((r) => r.json())
      .then((s: Status) => live && setStatus(s.state ? s : { state: 'open' }))
      .catch(() => live && setStatus({ state: 'open' }))
    return () => {
      live = false
    }
  }, [])

  const finish = (result: Done) => {
    window.scrollTo(0, 0)
    setDone(result)
  }

  // Back to the poster and a fresh form (the draft was cleared on success), e.g. to register a friend.
  const backToHome = () => {
    setDone(null)
    window.scrollTo(0, 0)
  }

  const goToForm = () => {
    document.getElementById('register')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    document.querySelector<HTMLInputElement>('#register input:not([type=hidden])')?.focus({ preventScroll: true })
  }

  if (done?.kind === 'created') return <SuccessScreen values={done.values} onBack={backToHome} />
  if (done?.kind === 'duplicate') return <DuplicateNotice onBack={backToHome} />

  return (
    <main>
      <Hero onRegister={goToForm} />

      <section id="register" aria-labelledby="register-heading" className="mx-auto max-w-[480px] scroll-mt-4 px-4 pb-10 pt-9">
        <div className="text-center">
          <Sparkle size={22} className="mx-auto text-magenta" />
          <h2 id="register-heading" className="mt-2 font-display text-h1 font-semibold text-burgundy">
            Register
          </h2>
          <p id="form-intro" className="mt-1 font-text text-lead text-muted">
            {status.state === 'not_open' || status.state === 'closed' ? 'Registration happens right here on this page.' : "It's free and takes about a minute."}
          </p>
        </div>
        <div className="mt-6">
          {!hydrated || status.state === 'loading' ? (
            <FormPlaceholder />
          ) : status.state === 'open' ? (
            <div className="rounded-lg bg-white px-5 pb-4 pt-6 shadow-card">
              <Suspense fallback={<FormPlaceholder />}>
                <RegistrationForm onDone={finish} onClosed={(state) => setStatus({ state })} />
              </Suspense>
            </div>
          ) : (
            <ClosedPanel state={status.state} opensAt={status.opensAt} />
          )}
        </div>
      </section>

      <footer className="mx-auto max-w-[480px] px-4 pb-10 text-center font-text text-small text-muted">
        <p>
          Questions? Email{' '}
          <a href={`mailto:${EVENT.contactEmail}`} className="font-semibold text-magenta-700 underline underline-offset-2">
            {EVENT.contactEmail}
          </a>
        </p>
        <p className="mt-1">
          {EVENT.host} ·{' '}
          <a href="/privacy" className="underline underline-offset-2">
            Privacy notice
          </a>
        </p>
      </footer>
    </main>
  )
}

function FormPlaceholder() {
  return <div className="min-h-[1100px]" aria-busy="true" />
}

const noopSubscribe = () => () => {}
