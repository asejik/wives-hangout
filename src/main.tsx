import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './styles/theme.css'
import App from './App.tsx'

const root = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// dist/index.html is prerendered at build time (scripts/prerender.mjs); `npm run dev` is not.
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)
