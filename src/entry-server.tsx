import { StrictMode, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'

// Build-time prerender (scripts/prerender.mjs): pages are in the HTML before any JS runs.
const html = (node: ReactNode) => renderToString(<StrictMode>{node}</StrictMode>)

export const pages: Record<string, () => string> = {
  'index.html': () => html(<App />),
}
