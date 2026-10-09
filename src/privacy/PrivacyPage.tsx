import type { ReactNode } from 'react'
import { EVENT } from '../../shared/event'

// Plain-language privacy notice (NDPA 2023). Not legal advice: the church should have it reviewed if it can.
// Retention: builder decision 2026-10-09 (delete by 24 January 2027, three months after the event).
const UPDATED = '9 October 2026'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-h2 font-semibold text-burgundy">{title}</h2>
      <div className="mt-2 space-y-2 font-text text-body text-ink">{children}</div>
    </section>
  )
}

const mail = (
  <a href={`mailto:${EVENT.contactEmail}`} className="font-semibold text-magenta-700 underline underline-offset-2">
    {EVENT.contactEmail}
  </a>
)

export function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 pb-16 pt-6">
      <a href="/" className="inline-block rounded-sm focus-visible:shadow-focus focus-visible:outline-none">
        <picture className="block w-12">
          <source srcSet="/assets/clc-logo-black.webp" type="image/webp" />
          <img src="/assets/clc-logo-black.png" alt={`${EVENT.host}: back to registration`} width={160} height={204} className="h-auto w-full" />
        </picture>
      </a>

      <h1 className="mt-6 font-display text-h1 font-semibold text-burgundy">Privacy notice</h1>
      <p className="mt-2 font-text text-body text-muted">
        {EVENT.name} registration · Last updated {UPDATED}
      </p>

      <Section title="Who we are">
        <p>
          {EVENT.host}, Ilorin, runs {EVENT.name} and this registration page. We are responsible for the information you
          give us here. Contact us at {mail}.
        </p>
      </Section>

      <Section title="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Your full name and how many years you've been married</li>
          <li>Your phone (WhatsApp) number and email address</li>
          <li>Your church, and how you heard about {EVENT.name}</li>
          <li>Whether you'll need to bring a child because of childcare limitations</li>
          <li>Your agreement to this notice, the time you registered, and whether we managed to email you a copy</li>
        </ul>
        <p>We don't ask for your date of birth, address, ID or photos.</p>
      </Section>

      <Section title="Why we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>To plan the event: headcount, seating and childcare</li>
          <li>To email you a copy of your registration and the event details</li>
          <li>To contact you about {EVENT.name} by phone, WhatsApp or email if plans change</li>
        </ul>
        <p>We use your details because you agreed to this when you registered.</p>
      </Section>

      <Section title="Who can see it">
        <p>
          Only the church team organising {EVENT.name}. We do not sell your details or share them outside the church.
        </p>
        <p>
          Your details are stored for us by two service providers: <b>Supabase</b> (our secure database, in London) and{' '}
          <b>Google</b> (a Google Sheet the team works from, and the Gmail account that sends your confirmation). Their
          servers are outside Nigeria.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Only as long as we need it for the event. We will delete all registration details by <b>24 January 2027</b>, three
          months after the event, or sooner.
        </p>
      </Section>

      <Section title="Your rights">
        <p>Under the Nigeria Data Protection Act 2023 you can ask us to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>show you the information we hold about you</li>
          <li>correct anything that's wrong</li>
          <li>delete your information</li>
        </ul>
        <p>
          Email {mail} from the address you registered with, and we'll respond as soon as we can. If you're not happy with our
          response, you can complain to the Nigeria Data Protection Commission.
        </p>
      </Section>

      <p className="mt-10">
        <a href="/" className="font-caps text-button font-semibold uppercase text-burgundy underline underline-offset-4">
          ← Back to registration
        </a>
      </p>
    </main>
  )
}
