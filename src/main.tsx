import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app'
// Font tự host (không chặn render bởi Google Fonts, ổn định trong in-app browser).
import '@fontsource/be-vietnam-pro/latin-400.css'
import '@fontsource/be-vietnam-pro/latin-500.css'
import '@fontsource/be-vietnam-pro/latin-600.css'
import '@fontsource/be-vietnam-pro/vietnamese-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-500.css'
import '@fontsource/be-vietnam-pro/vietnamese-600.css'
import '@fontsource/playfair-display/latin-500.css'
import '@fontsource/playfair-display/latin-500-italic.css'
import '@fontsource/playfair-display/vietnamese-500.css'
import '@fontsource/playfair-display/vietnamese-500-italic.css'
import './styles/tokens.css'
import './styles/global.css'
import './styles/sections.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
