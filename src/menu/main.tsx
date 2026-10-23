import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '../styles/theme.css'
import { MenuPage } from './MenuPage'

const root = document.getElementById('root')!
const page = (
  <StrictMode>
    <MenuPage />
  </StrictMode>
)
if (root.hasChildNodes()) hydrateRoot(root, page)
else createRoot(root).render(page)
