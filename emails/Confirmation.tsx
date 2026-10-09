import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from '@react-email/components'
import { EVENT } from '../shared/event'

/**
 * Confirmation / re-send email: a copy of the registration details plus the event facts.
 * Authored with Tailwind; React Email inlines the classes at build time (`npm run email:build`),
 * producing api/_lib/email-template.ts. {{PLACEHOLDERS}} are filled and HTML-escaped at send time.
 *
 * Fluid layout only: no `sm:`/`md:` classes (React Email + Tailwind 4 inlines them unconditionally),
 * and no <Font> (it sets `* { font-family }`). Colours mirror src/styles/theme.css (temporary theme).
 */
const PLACEHOLDERS = [
  'PREVIEW', 'HEADING', 'INTRO', 'FULL_NAME', 'YEARS_MARRIED', 'PHONE', 'EMAIL', 'CHURCH', 'HEARD', 'CHILD', 'SITE_URL',
] as const
const p = (name: (typeof PLACEHOLDERS)[number]) => `{{${name}}}`

const FONT_FACES =
  "@font-face{font-family:'Cormorant Garamond';font-style:italic;font-weight:600;" +
  "src:url(https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtImSo.woff2) format('woff2');}"

const config = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        ivory: '#FBF5EE',
        linen: '#F3E6DA',
        wine: '#5A1A30',
        ink: '#2B1419',
        muted: '#6B5459',
        gold: '#D4AF62',
        'gold-700': '#7A571B',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', '"Times New Roman"', 'serif'],
        text: ['Arial', 'Helvetica', 'sans-serif'],
      },
    },
  },
}

const DETAILS: [string, (typeof PLACEHOLDERS)[number]][] = [
  ['Full name', 'FULL_NAME'],
  ['Years married', 'YEARS_MARRIED'],
  ['Phone (WhatsApp)', 'PHONE'],
  ['Email', 'EMAIL'],
  ['Church', 'CHURCH'],
  ['How you heard', 'HEARD'],
  ['Bringing a child', 'CHILD'],
]

const EVENT_FACTS: [string, string][] = [
  ['Date', EVENT.date],
  ['Time', EVENT.time],
  ['Venue', EVENT.venue],
]

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <Row className="border-0 border-b border-solid border-linen">
      <Column className="w-[38%] py-2.5 pr-3 align-top text-[12px] font-bold uppercase leading-[18px] tracking-[1px] text-muted">
        {label}
      </Column>
      <Column className="py-2.5 align-top text-[16px] leading-[22px] text-ink">{value}</Column>
    </Row>
  )
}

export function Confirmation() {
  return (
    <Html lang="en">
      <Tailwind config={config}>
        <Head>
          <meta name="color-scheme" content="light only" />
          <meta name="supported-color-schemes" content="light" />
          <style>{FONT_FACES}</style>
        </Head>
        <Preview>{p('PREVIEW')}</Preview>
        <Body className="m-0 bg-ivory px-0 py-6 font-text text-ink">
          <Container className="mx-auto w-full max-w-[600px] bg-ivory">
            <Section className="rounded-t-[20px] bg-wine px-6 pb-7 pt-7 text-center">
              <Img
                src={`${p('SITE_URL')}/assets/clc-logo.png`}
                alt={EVENT.host}
                width="56"
                height="71"
                className="mx-auto block rounded-[8px] bg-ivory p-1.5"
              />
              <Text className="m-0 mt-4 font-display text-[40px] italic leading-[44px] text-ivory">{EVENT.name}</Text>
              <Text className="m-0 mt-2 text-[13px] font-bold uppercase leading-[18px] tracking-[2px] text-gold">
                {EVENT.date} · {EVENT.time}
              </Text>
            </Section>

            <Section className="px-5 pb-2 pt-7 text-center">
              <Text className="m-0 font-display text-[28px] italic leading-[32px] text-wine">{p('HEADING')}</Text>
              <Text className="m-0 mt-3 text-[16px] leading-[24px] text-ink">{p('INTRO')}</Text>
            </Section>

            <Section className="px-5 pt-4">
              <Section className="rounded-[12px] border border-solid border-linen bg-[#FFFFFF] px-5 py-3">
                <Text className="m-0 pb-1 pt-2 text-[12px] font-bold uppercase leading-[16px] tracking-[2px] text-gold-700">
                  Your registration
                </Text>
                {DETAILS.map(([label, key]) => (
                  <LabelValue key={key} label={label} value={p(key)} />
                ))}
              </Section>
            </Section>

            <Section className="px-5 pt-5">
              <Section className="rounded-[12px] bg-linen px-5 py-3">
                <Text className="m-0 pb-1 pt-2 text-[12px] font-bold uppercase leading-[16px] tracking-[2px] text-gold-700">
                  The event
                </Text>
                {EVENT_FACTS.map(([label, value]) => (
                  <LabelValue key={label} label={label} value={value} />
                ))}
              </Section>
            </Section>

            <Section className="px-5 pb-2 pt-7 text-center">
              <Text className="m-0 font-display text-[24px] italic leading-[28px] text-wine">We look forward to seeing you!</Text>
              <Text className="m-0 mt-1 text-[14px] leading-[20px] text-muted">{EVENT.host}</Text>
            </Section>

            <Section className="px-5 pb-4 pt-4 text-center">
              <Text className="m-0 text-[12px] leading-[18px] text-muted">
                You're receiving this because you registered for {EVENT.name} at {p('SITE_URL')}. If a detail is wrong or
                this wasn't you, reply to this email. How we use your details:{' '}
                <Link href={`${p('SITE_URL')}/privacy`} className="text-wine underline">
                  privacy notice
                </Link>
                .
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default Confirmation
