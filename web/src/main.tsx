import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// The three type families. The build carries the font files, so the page waits on
// no other server and the demo works with no network.
//
// Only the Latin subset, and only the weights that the interface uses. Each extra
// weight is another file to send.
import '@fontsource/instrument-serif/latin-400.css'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import '@fontsource/geist-sans/latin-600.css'
import '@fontsource/geist-mono/latin-400.css'
import '@fontsource/geist-mono/latin-500.css'

// The tokens come before the base, because the base reads them.
// `tools/gen_palette.py` makes the token file. Do not edit it by hand.
import './styles/tokens.css'
import './index.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)