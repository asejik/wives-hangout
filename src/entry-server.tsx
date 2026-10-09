import { StrictMode, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'
import { PrivacyPage } from './privacy/PrivacyPage'

// Build-time prerender (scripts/prerender.mjs): pages are in the HTML before any JS runs.
// The lazy form isn't rendered here (App mounts it only after hydration), so hydration matches.
const html = (node: ReactNode) => renderToString(<StrictMode>{node}</StrictMode>)

export const pages: Record<string, () => string> = {
  'index.html': () => html(<App />),
  'privacy.html': () => html(<PrivacyPage />),
}
