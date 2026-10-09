import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { CHURCHES, COPY, HEARD_VIA, YES_NO } from '../../shared/event'
import { registrationSchema, type Registration, type RegistrationInput } from '../../shared/registration'
import { clearDraft, loadDraft, saveDraft } from '../lib/draft'
import { sourceTag, submitRegistration, type SubmitResult } from '../lib/submit'
import { Button } from './Button'
import { CheckboxField } from './form/CheckboxField'
import { ChoiceField } from './form/ChoiceField'
import { SelectField } from './form/SelectField'
import { TextField } from './form/TextField'

type Closed = Extract<SubmitResult, { kind: 'closed' | 'not_open' }>['kind']
type Banner = 'offline' | 'error' | 'rate_limited' | null
export type Done = { kind: 'created'; values: Registration; venue: string } | { kind: 'duplicate' }

const SLOW_AFTER_MS = 8_000

const BANNER_TEXT: Record<Exclude<Banner, null>, string> = {
  offline: "You seem to be offline. Your answers are still here. Tap the button again when you're connected.",
  rate_limited: 'Lots of registrations are coming from your network right now. Your answers are still here. Please try again in a few minutes.',
  error: "We couldn't save your registration. Your answers are still here. Please try again in a minute.",
}

export function RegistrationForm({ onDone, onClosed }: { onDone: (result: Done) => void; onClosed: (state: Closed) => void }) {
  const [banner, setBanner] = useState<Banner>(null)
  const [slow, setSlow] = useState(false)
  const bannerRef = useRef<HTMLDivElement>(null)
  const openedAt = useRef(0)
  useEffect(() => {
    openedAt.current = Date.now()
  }, [])

  const {
    register,
    handleSubmit,
    control,
    subscribe,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationInput, unknown, Registration>({
    resolver: zodResolver(registrationSchema),
    mode: 'onTouched',
    shouldFocusError: true,
    defaultValues: {
      // '' for the select, so its placeholder shows instead of silently picking the first option.
      full_name: '', years_married: '', phone: '', email: '', church_other: '', heard_via: '' as RegistrationInput['heard_via'],
      heard_other: '', ...loadDraft(), source: sourceTag(),
    },
  })

  useEffect(() => subscribe({ formState: { values: true }, callback: ({ values }) => saveDraft(values) }), [subscribe])

  const church = useWatch({ control, name: 'church' })
  const heardVia = useWatch({ control, name: 'heard_via' })

  useEffect(() => {
    if (banner) bannerRef.current?.focus()
  }, [banner])

  const onSubmit = async (values: Registration, event?: React.BaseSyntheticEvent) => {
    setBanner(null)
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    const result = await submitRegistration(values, {
      website: String(new FormData(event?.target as HTMLFormElement).get('website') ?? ''),
      elapsed_ms: Date.now() - openedAt.current,
    })
    clearTimeout(slowTimer)
    setSlow(false)

    if (result.kind === 'created') {
      clearDraft()
      return onDone({ kind: 'created', values, venue: result.venue })
    }
    if (result.kind === 'duplicate') {
      clearDraft()
      return onDone({ kind: 'duplicate' })
    }
    if (result.kind === 'closed' || result.kind === 'not_open') return onClosed(result.kind)
    if (result.kind === 'invalid') {
      const names = Object.keys(result.fields) as (keyof RegistrationInput)[]
      names.forEach((name) => setError(name, { message: result.fields[name] }))
      if (names[0]) setFocus(names[0])
      return
    }
    setBanner(result.kind)
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate aria-describedby="form-intro" className="relative">
      <TextField label="Full name" autoComplete="name" registration={register('full_name')} error={errors.full_name?.message} />

      <TextField
        label="How many years married?"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        autoComplete="off"
        placeholder="e.g. 5"
        hint="Enter 0 if it's less than a year."
        registration={register('years_married')}
        error={errors.years_married?.message}
      />

      <TextField
        label="Phone number (WhatsApp)"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="08012345678"
        registration={register('phone')}
        error={errors.phone?.message}
      />

      <TextField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="name@gmail.com"
        hint="We'll email you a copy of your registration."
        registration={register('email')}
        error={errors.email?.message}
      />

      <ChoiceField legend="Church" options={CHURCHES} layout="stack" registration={register('church')} error={errors.church?.message} />
      {church === 'Other' && (
        <TextField
          className="reveal -mt-2"
          label="Name of your church"
          autoComplete="organization"
          registration={register('church_other')}
          error={errors.church_other?.message}
        />
      )}

      <SelectField
        label="How did you hear about the Wives Hangout?"
        placeholder="Choose one"
        options={HEARD_VIA}
        registration={register('heard_via')}
        error={errors.heard_via?.message}
      />
      {heardVia === 'Other' && (
        <TextField
          className="reveal -mt-2"
          label="Where did you hear about it?"
          registration={register('heard_other')}
          error={errors.heard_other?.message}
        />
      )}

      <ChoiceField legend={COPY.childQuestion} options={YES_NO} registration={register('bringing_child')} error={errors.bringing_child?.message} />

      <div className="mt-6">
        <CheckboxField registration={register('consent')} error={errors.consent?.message}>
          {COPY.consent}{' '}
          <a href="/privacy" target="_blank" rel="noopener" className="font-semibold text-magenta-700 underline underline-offset-2">
            Read the privacy notice
          </a>
          .
        </CheckboxField>
      </div>

      {banner && (
        <div
          ref={bannerRef}
          tabIndex={-1}
          role="alert"
          className="reveal mt-4 flex items-start gap-2.5 rounded-md border-[length:var(--border-field)] border-error bg-white p-4 font-text text-body text-ink outline-none"
        >
          {banner === 'offline' ? (
            <WifiOff aria-hidden size={22} strokeWidth={2} className="mt-0.5 shrink-0 text-error" />
          ) : (
            <CircleAlert aria-hidden size={22} strokeWidth={2} className="mt-0.5 shrink-0 text-error" />
          )}
          <span>{BANNER_TEXT[banner]}</span>
        </div>
      )}

      {/* Honeypot: invisible to people (and screen readers); bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <Button type="submit" loading={isSubmitting} className="mt-5 w-full">
        {isSubmitting ? 'Registering…' : 'Register'}
      </Button>
      <p aria-live="polite" className="mt-3 min-h-6 text-center font-text text-small text-muted">
        {slow ? 'Still working, please keep this page open.' : ''}
      </p>
    </form>
  )
}
