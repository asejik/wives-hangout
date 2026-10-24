import { CircleAlert, UtensilsCrossed } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EVENT } from '../../shared/event'
import { parseSeat, parseWho, WHO_HINT, type MealChoice, type MenuItem } from '../../shared/menu'
import { Button } from '../components/Button'
import { CompactHero } from '../components/Hero'
import { Sparkle } from '../components/Sparkle'
import { controlClass, labelClass } from '../components/form/field-utils'
import { MealPass } from './MealPass'
import { Modal } from './Modal'

type WindowState = 'loading' | 'open' | 'not_open' | 'closed'
type Me = { who: string; fullName: string; choice: MealChoice | null }

const POLL_MS = 5_000
const WHO_KEY = 'wives-hangout-menu-who' // so a refresh doesn't lose who she is (this tab only)

const store = {
  get: () => { try { return window.sessionStorage.getItem(WHO_KEY) ?? '' } catch { return '' } },
  set: (v: string) => { try { window.sessionStorage.setItem(WHO_KEY, v) } catch { /* ignore */ } },
  clear: () => { try { window.sessionStorage.removeItem(WHO_KEY) } catch { /* ignore */ } },
}

async function post(path: string, body: object) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) })
  return { http: res.status, body: await res.json().catch(() => ({})) }
}

const firstName = (full: string) => full.trim().split(/\s+/)[0]

export function MenuPage() {
  const [state, setState] = useState<WindowState>('loading')
  const [items, setItems] = useState<MenuItem[]>([])
  const [whoInput, setWhoInput] = useState('')
  const [whoError, setWhoError] = useState('')
  const [checking, setChecking] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [pending, setPending] = useState<MenuItem | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [notice, setNotice] = useState('')
  const [pass, setPass] = useState<{ fullName: string; choice: MealChoice } | null>(null)
  const [seat, setSeat] = useState('')
  const [seatError, setSeatError] = useState('')
  const [editingSeat, setEditingSeat] = useState(false)
  const [savingSeat, setSavingSeat] = useState(false)

  // Before choosing, the seat number is required (e.g. 27 or B12).
  const startChoosing = (item: MenuItem) => {
    if (!parseSeat(seat)) {
      setSeatError('Enter your seat number first (e.g. 27 or B12).')
      document.getElementById('seat')?.focus()
      return
    }
    setSeatError('')
    setPending(item)
  }

  // Add or correct the seat on an existing choice (the meal itself never changes).
  const saveSeat = async () => {
    if (!me) return
    const t = parseSeat(seat)
    if (!t) return setSeatError('Enter your seat number (e.g. 27 or B12).')
    setSeatError('')
    setSavingSeat(true)
    try {
      const { http, body } = await post('/api/menu-seat', { who: me.who, seat: t })
      if (body.status === 'updated') {
        setMe({ ...me, fullName: body.full_name, choice: body.choice })
        setEditingSeat(false)
        setNotice(`Seat number saved: ${t}.`)
      } else if (http === 403) {
        setSeatError('Meal selection has closed. Please tell a host your seat number.')
      } else {
        setSeatError(http === 429 ? 'Too many tries from this network. Please wait a few minutes.' : "We couldn't save it. Please try again.")
      }
    } catch {
      setSeatError('No connection. Please try again.')
    } finally {
      setSavingSeat(false)
    }
  }

  // Live counts: poll while the page is visible (keeps the last counts if a poll fails).
  useEffect(() => {
    const load = () =>
      fetch('/api/menu', { signal: AbortSignal.timeout(8_000) })
        .then((r) => r.json())
        .then((data: { state?: WindowState; items?: MenuItem[] }) => {
          if (Array.isArray(data.items)) setItems(data.items)
          if (data.state) setState(data.state)
        })
        .catch(() => {})
    void load()
    const id = window.setInterval(() => document.visibilityState === 'visible' && void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [])

  const find = useCallback(async (raw: string) => {
    setWhoError('')
    setNotice('')
    if (!parseWho(raw)) return setWhoError(`${WHO_HINT}, e.g. 08012345678 or name@gmail.com`)
    setChecking(true)
    try {
      const { http, body } = await post('/api/menu-lookup', { who: raw })
      if (body.status === 'found') {
        setMe({ who: raw, fullName: body.full_name, choice: body.choice })
        store.set(raw)
      } else if (body.status === 'not_found') {
        setWhoError("We couldn't find a registration with that. Try the other one (phone number or email), or ask a host to help.")
        store.clear()
      } else {
        setWhoError(http === 429 ? 'Too many tries from this network. Please wait a few minutes.' : 'Something went wrong. Please try again.')
      }
    } catch {
      setWhoError('No connection. Please check your internet and try again.')
    } finally {
      setChecking(false)
    }
  }, [])

  // Back after a refresh: look her up again quietly (if it fails, she simply types it again).
  useEffect(() => {
    const saved = store.get()
    if (!saved) return
    post('/api/menu-lookup', { who: saved })
      .then(({ body }) => {
        if (body.status === 'found') setMe({ who: saved, fullName: body.full_name, choice: body.choice })
        else store.clear()
      })
      .catch(() => {})
  }, [])

  const confirm = async () => {
    if (!me || !pending) return
    setChoosing(true)
    setNotice('')
    try {
      const { http, body } = await post('/api/menu-choose', { who: me.who, item: pending.item_id, seat: parseSeat(seat) })
      if (Array.isArray(body.items)) setItems(body.items)
      if (body.status === 'created' || body.status === 'already_chosen') {
        setMe({ ...me, fullName: body.full_name, choice: body.choice })
        setPass({ fullName: body.full_name, choice: body.choice })
        if (body.status === 'already_chosen') setNotice('You had already chosen your meal. Here it is.')
      } else if (body.status === 'invalid_seat') {
        setSeatError('Enter your seat number first (e.g. 27 or B12).')
      } else if (body.status === 'sold_out') {
        setNotice(`Sorry, ${pending.name} just finished. Please choose another dish.`)
      } else if (http === 403) {
        setState(body.status === 'not_open' ? 'not_open' : 'closed')
      } else {
        setNotice(http === 429 ? 'Too many tries from this network. Please wait a few minutes.' : "We couldn't save your choice. Please try again.")
      }
    } catch {
      setNotice('No connection. Your choice was not saved. Please try again.')
    } finally {
      setChoosing(false)
      setPending(null)
    }
  }

  const canChoose = state === 'open' && me !== null && me.choice === null

  return (
    <main className="min-h-dvh pb-12">
      <CompactHero />
      <section className="mx-auto max-w-[480px] px-4">
        <div className="pt-7 text-center">
          <Sparkle size={22} className="mx-auto text-magenta" />
          <h1 className="mt-2 font-display text-h1 font-semibold text-burgundy">Choose your meal</h1>
          <p className="mt-1 font-text text-lead text-muted">One plate per person, and you can't change it after.</p>
          <p className="mt-1 font-text text-small text-muted">Choosing closes {EVENT.menuClosesLabel}.</p>
        </div>

        {state === 'closed' && <Banner text="Meal selection has closed. Please speak to a host." />}
        {state === 'not_open' && <Banner text="Meal selection isn't open yet. Please check back soon." />}

        {/* Step 1: who is she? */}
        <div className="mt-6 rounded-lg bg-white px-5 py-5 shadow-card">
          {me ? (
            <div>
              <p className="font-display text-h2 font-semibold text-burgundy">Hi, {firstName(me.fullName)}!</p>
              <p className="mt-1 font-text text-small text-muted">
                Not you?{' '}
                <button
                  type="button"
                  className="min-h-11 font-semibold text-magenta-700 underline underline-offset-2"
                  onClick={() => { setMe(null); setWhoInput(''); store.clear(); setNotice('') }}
                >
                  Change
                </button>
              </p>
              {me.choice ? (
                <div className="mt-4">
                  <MealPass fullName={me.fullName} choice={me.choice} />
                  {state === 'open' && (me.choice.seat_no === '' || editingSeat ? (
                    <SeatField
                      label={me.choice.seat_no ? 'Change your seat number' : 'Add your seat number'}
                      value={seat}
                      error={seatError}
                      onChange={setSeat}
                      action={
                        <Button type="button" loading={savingSeat} className="mt-3 w-full" onClick={() => void saveSeat()}>
                          {savingSeat ? 'Saving…' : 'Save seat number'}
                        </Button>
                      }
                    />
                  ) : (
                    <p className="mt-3 text-center font-text text-small text-muted">
                      Changed seats?{' '}
                      <button
                        type="button"
                        className="min-h-11 font-semibold text-magenta-700 underline underline-offset-2"
                        onClick={() => { setSeat(me.choice?.seat_no ?? ''); setEditingSeat(true) }}
                      >
                        Change seat number
                      </button>
                    </p>
                  ))}
                </div>
              ) : state === 'open' ? (
                <>
                  <SeatField label="Your seat number" value={seat} error={seatError} onChange={setSeat} />
                  <p className="mt-3 font-text text-body text-ink">Then tap the dish you want below.</p>
                </>
              ) : null}
            </div>
          ) : (
            <form noValidate onSubmit={(e) => { e.preventDefault(); void find(whoInput) }}>
              <label htmlFor="who" className={labelClass}>
                Phone number or email you registered with
              </label>
              <input
                id="who"
                value={whoInput}
                onChange={(e) => setWhoInput(e.target.value)}
                autoComplete="tel"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="08012345678 or name@gmail.com"
                aria-invalid={whoError ? true : undefined}
                aria-describedby={whoError ? 'who-error' : undefined}
                className={controlClass(!!whoError)}
              />
              {whoError && (
                <p id="who-error" role="alert" className="mt-2 flex items-start gap-1.5 font-text text-small font-semibold text-error">
                  <CircleAlert aria-hidden size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                  {whoError}
                </p>
              )}
              <Button type="submit" loading={checking} className="mt-4 w-full">
                {checking ? 'Checking…' : 'Continue'}
              </Button>
            </form>
          )}
        </div>

        {notice && <Banner text={notice} />}

        {/* The menu */}
        <h2 className="mt-8 flex items-center gap-2 font-caps text-eyebrow font-semibold uppercase text-magenta-700">
          <UtensilsCrossed aria-hidden size={16} strokeWidth={2} /> Menu
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 font-text text-body text-muted" aria-busy="true">Loading the menu…</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {items.map((item) => {
              const finished = item.remaining <= 0
              const mine = me?.choice?.item_id === item.item_id
              return (
                <li key={item.item_id} className={`flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-card ${mine ? 'ring-2 ring-magenta' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`font-text text-body font-semibold ${finished ? 'text-muted line-through' : 'text-ink'}`}>{item.name}</p>
                    <p className={`mt-0.5 font-text text-small font-semibold ${finished ? 'text-muted' : item.remaining <= 3 ? 'text-error' : 'text-magenta-700'}`}>
                      {mine ? 'Your choice' : finished ? 'Finished' : `${item.remaining} left`}
                    </p>
                  </div>
                  {canChoose && !finished && (
                    <button
                      type="button"
                      onClick={() => startChoosing(item)}
                      className="min-h-11 shrink-0 rounded-pill bg-burgundy px-5 font-caps text-button font-semibold uppercase text-white transition-colors duration-[var(--dur-fast)] hover:bg-wine focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-magenta"
                    >
                      Choose
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {state === 'open' && !me && items.length > 0 && (
          <p className="mt-3 text-center font-text text-small text-muted">Enter your phone number or email above to choose.</p>
        )}
      </section>

      {pending && (
        <Modal label="Confirm your meal" onClose={choosing ? undefined : () => setPending(null)}>
          <div className="px-5 py-6 text-center">
            <p className="font-text text-body text-ink">Choose this meal?</p>
            <p className="mt-2 font-display text-h2 font-semibold text-burgundy">{pending.name}</p>
            <p className="mt-1 font-text text-body font-semibold text-ink">Seat {parseSeat(seat)}</p>
            <p className="mt-2 font-text text-small text-muted">You can't change it after this.</p>
            <div className="mt-5 grid gap-2.5">
              <Button data-autofocus loading={choosing} onClick={() => void confirm()}>
                {choosing ? 'Saving…' : 'Yes, choose it'}
              </Button>
              <Button variant="secondary" disabled={choosing} onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {pass && (
        <Modal label="Your meal" onClose={() => setPass(null)}>
          <div className="p-4">
            <MealPass fullName={pass.fullName} choice={pass.choice} />
            <Button data-autofocus variant="secondary" className="mt-4 w-full" onClick={() => setPass(null)}>
              Done
            </Button>
          </div>
        </Modal>
      )}

      <footer className="mx-auto mt-10 max-w-[480px] px-4 text-center font-text text-small text-muted">
        {EVENT.host} · {EVENT.name}
      </footer>
    </main>
  )
}

function SeatField({ label, value, error, onChange, action }: {
  label: string; value: string; error: string; onChange: (v: string) => void; action?: React.ReactNode
}) {
  return (
    <div className="mt-4">
      <label htmlFor="seat" className={labelClass}>{label}</label>
      <input
        id="seat"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={6}
        autoComplete="off"
        placeholder="e.g. 27"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'seat-error' : 'seat-hint'}
        className={controlClass(!!error)}
      />
      {error ? (
        <p id="seat-error" role="alert" className="mt-2 flex items-start gap-1.5 font-text text-small font-semibold text-error">
          <CircleAlert aria-hidden size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : (
        <p id="seat-hint" className="mt-2 font-text text-small text-muted">The number on your seat, so the servers can find you.</p>
      )}
      {action}
    </div>
  )
}

function Banner({ text }: { text: string }) {
  return (
    <p role="status" className="reveal mt-4 rounded-md border-[length:var(--border-field)] border-burgundy bg-white px-4 py-3 text-center font-text text-body font-semibold text-burgundy">
      {text}
    </p>
  )
}
