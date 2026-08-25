import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Self-hosted so the app renders identically offline — no third-party font request.
import '@fontsource-variable/inter'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/jetbrains-mono'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
