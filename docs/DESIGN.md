# DESIGN.md: Wives Hangout

**Direction: "The flyer, made tappable"** (builder approved, 2026-10-09). Source: `brand/wives hangout - flyer.png`, the title lettering `brand/wives hangout - text.png`, and the church logo variants (`clc-logo-white.png`, `clc-logo-black.png`; the orange version is optional).

- **Hero:** sky gradient (sampled from the flyer), white church logo, the flyer's title lettering, the burgundy theme band ("Marriage, Motherhood and Ministry"), the photo of the five women, then a wine block with the date, time and venue and a white "Register free" button.
- **Below:** a blush page with the form on a white card.
- **Signature moment (one):** the flyer's four-point sparkle pops in on the success screen (`animate-sparkle-in`, off with reduced motion). The sparkle (`src/components/Sparkle.tsx`) is the recurring motif.

**All UI uses the tokens in `src/styles/theme.css`.** If something is missing, add a token first.

## Colour

| Token | Hex | Role |
|---|---|---|
| `sky-700` | `#0C86AA` | Top of the hero sky |
| `sky` | `#2A9DB5` | Mid sky |
| `sky-200` | `#98B2BD` | Sky above the band; top of the photo backdrop |
| `burgundy` | `#68001F` | Theme band, primary button, headings |
| `wine` | `#6E0327` | Event facts block, success-screen card (the flyer's lower gradient) |
| `magenta` | `#C82070` | Ribbon: sparkles, focus ring, selected choice. Never small text on petal. |
| `magenta-700` | `#A8185C` | Magenta text and links on light backgrounds |
| `rose` | `#F4B6CB` | Soft pink on wine (icons, theme line); the photo backdrop's middle |
| `blush` | `#FFF7F9` | Page background below the hero |
| `petal` | `#F8E6EC` | Tinted panels, selected choice fill |
| `white` | `#FFFFFF` | Cards, inputs |
| `ink` | `#2A0C16` | Body text |
| `muted` | `#6E4D58` | Secondary text, input borders |
| `error` | `#B3261E` | Errors (always with an icon and a message) |
| `success` | `#1F6B3A` | Rare inline success |

**Contrast (WCAG 2.2 AA, computed):** ink/blush 17.1 · ink/white 18.1 · ink/petal 15.1 · muted/white 7.3 · muted/petal 6.1 · burgundy/white 13.1 · white/burgundy 13.1 · white/wine 12.3 · rose/wine 7.3 · magenta-700/white 7.1 · magenta-700/petal 5.9 · magenta/white 5.4 · error/white 6.5. All text pairs ≥ 4.5. White on `sky-700` (4.2) is used only for the large title lettering (≥ 3:1) and the logo.

## Type

Self-hosted variable woff2 (latin) in `public/fonts/`. The title is the flyer's own lettering (image, `alt="Wives Hangout"`).

- **Caps (`font-caps`):** Oswald 600, uppercase. Theme band, buttons, eyebrows (the flyer's tagline face).
- **Display (`font-display`):** Cormorant Garamond 600. Section and screen headings.
- **Text (`font-text`):** Figtree 400/600/700.

| Token | Size / line height | Use |
|---|---|---|
| `text-h1` | 38 / 1.05 | "Register", "You're registered!", privacy title |
| `text-h2` | 30 / 1.1 | Panel headings, privacy sections |
| `text-band` | 17 / 1.15, caps | Theme band (one line at 360px) |
| `text-eyebrow` | 14 / 1.2, caps | Small caps labels |
| `text-button` | 19 / 1, caps | Buttons |
| `text-lead` | 18 / 1.45 | Intro lines, date |
| `text-body` | 17 / 1.5 | Body, inputs |
| `text-label` | 16 / 1.3 | Field labels |
| `text-small` | 15 / 1.4 | Hints, errors, footer |
| `text-meta` | 13 / 1.3 | Fine print |

## Shape, depth, motion

- Radii: `sm` 8, `md` 12, `lg` 20, `pill`. Shadows: `shadow-card`, `shadow-focus` (magenta ring).
- Fields: 1.5px `muted` border on white; focus → magenta border plus ring; error → `error` border.
- Motion: `--dur-fast` 150ms, `--dur-base` 250ms; `reveal` for the "Other" fields; `sparkle-in` on success. Everything is off under `prefers-reduced-motion`.

## Layout

Mobile-first at 360px. Hero full-bleed (photo max 640px, masked edges on wide screens); form column `max-w-[480px]`, 16px gutters. Touch targets ≥ 44px (fields and choices are 52px).

## Assets (`public/`)

- `assets/title.{webp,png}` (640px), `assets/hero-{720,1280}.{webp,jpg}` (photo crop between the band and the date text), `assets/clc-logo-{white,black}.{webp,png}`, `favicon.png`
- `assets/email-title.png` (email header, 480px for 240px display)
- `og.jpg`: `python3 scripts/make-og.py "brand/wives hangout - flyer.png"`
- `docs/launch/wives-hangout-qr.png`: `scripts/make-qr.mjs` with `brand/wives hangout - text.png` (title lettering on a burgundy plate; builder request)
- `brand/`: source artwork only, never loaded by the page (excluded from deploys by `.vercelignore`)

## Email

`emails/Confirmation.tsx`: burgundy header with the white logo and title lettering, the theme line in rose, the details card, the event card on petal. Fluid layout only (no `sm:`/`md:`), no `<Font>`. Run `npm run email:build` after any change.
