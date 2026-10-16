import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app'
import { prepareJourney } from './journey/prepare-journey'
// Font tự host (không chặn render bởi Google Fonts, ổn định trong in-app browser).
import '@fontsource/be-vietnam-pro/latin-400.css'
import '@fontsource/be-vietnam-pro/latin-500.css'
import '@fontsource/be-vietnam-pro/latin-600.css'
import '@fontsource/be-vietnam-pro/vietnamese-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-500.css'
import '@fontsource/be-vietnam-pro/vietnamese-600.css'
import '@fontsource/cormorant-garamond/latin-500.css'
import '@fontsource/cormorant-garamond/latin-600.css'
import '@fontsource/cormorant-garamond/latin-500-italic.css'
import '@fontsource/cormorant-garamond/vietnamese-500.css'
import '@fontsource/cormorant-garamond/vietnamese-600.css'
import '@fontsource/cormorant-garamond/vietnamese-500-italic.css'
import './styles/tokens.css'
import './styles/global.css'
import './styles/sections.css'

// Trước khi render: máy chạy 3D thì hero chờ cổng thay vì hiện ảnh trước.
prepareJourney()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
