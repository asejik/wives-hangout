import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '../styles/theme.css'
import { PrivacyPage } from './PrivacyPage'

const root = document.getElementById('root')!
const page = (
  <StrictMode>
    <PrivacyPage />
  </StrictMode>
)
if (root.hasChildNodes()) hydrateRoot(root, page)
else createRoot(root).render(page)
