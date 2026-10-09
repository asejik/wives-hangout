# DESIGN.md: Wives Hangout

**Status: TEMPORARY theme** (the flyer isn't ready). When it arrives (M3), re-theme by editing `src/styles/theme.css` only, then update this file.

**Direction:** warm and elegant, suited to a married women's fellowship. An invitation card: ivory paper, wine ink, thin gold ornaments, a serif italic title. One signature element: the gold rule-and-diamond ornament (`src/components/Ornament.tsx`).

**All UI uses these tokens.** If something is missing, add a token first.

## Colour

| Token | Hex | Role |
|---|---|---|
| `ivory` | `#FBF5EE` | Page background |
| `linen` | `#F3E6DA` | Raised surfaces, input fill |
| `wine` | `#5A1A30` | Title, headings, primary button, panels |
| `ink` | `#2B1419` | Body text |
| `muted` | `#6B5459` | Secondary text |
| `gold` | `#D4AF62` | Ornaments; text **only on wine** |
| `gold-700` | `#7A571B` | Gold text on ivory/linen (eyebrows) |
| `rose` | `#B5536A` | Decorative only, never text |
| `error` | `#B3261E` | Errors (always with icon + message) |
| `success` | `#1F6B3A` | Rare inline success |

**Contrast (WCAG 2.2 AA, computed):** ink/ivory 15.9 · ink/linen 14.1 · muted/ivory 6.4 · muted/linen 5.6 · wine/ivory 11.9 · ivory/wine 11.9 · gold/wine 6.2 · gold-700/ivory 6.1 · gold-700/linen 5.4 · error/ivory 6.0 · success/ivory 6.0. All ≥ 4.5.

## Type

Self-hosted variable woff2 (latin) in `public/fonts/`.
- **Display:** Cormorant Garamond, semibold italic (title, panel headings)
- **Text:** Figtree 400/600/700

| Token | Size / line height | Use |
|---|---|---|
| `text-display` | 60 / 0.95 | Event title |
| `text-h1` | 34 / 1.05 | Panel and section headings |
| `text-h2` | 28 / 1.1 | Sub-headings |
| `text-eyebrow` | 13 / 1.2, 0.18em, uppercase | "You're invited to" |
| `text-lead` | 18 / 1.45 | Intro lines |
| `text-body` | 17 / 1.5 | Body, inputs |
| `text-label` | 15 / 1.3 | Field labels |
| `text-small` | 15 / 1.4 | Footer, helper text |
| `text-meta` | 13 / 1.3 | Fine print |

## Shape, depth, motion

- Radii: `sm` 8, `md` 12, `lg` 20. Shadow: `shadow-card` (soft, warm). Rules: `--rule` 1px.
- Durations: `--dur-fast` 150ms, `--dur-base` 250ms, `--dur-slow` 400ms; `--ease-out`. All motion is off under `prefers-reduced-motion`.

## Layout

Single centred column, `max-w-[440px]`, 16px side padding; designed at 360px. Touch targets ≥ 44px; visible focus.

## Assets

- `public/assets/clc-logo.{webp,png}` (church logo, used exactly as supplied)
- `public/og.jpg` (1200×630, `scripts/make-og.py`)
- `docs/launch/wives-hangout-qr.png` (registration QR, church logo centre until the flyer logo exists)
- `brand/`: source artwork only, never loaded by the page
