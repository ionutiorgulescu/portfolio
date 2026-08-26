import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { AppProviders } from './providers'
import App from './App.tsx'
import {
  setupResumeDeployCheck,
  setupStaleChunkReload,
} from './utils/reloadOnStaleChunk'
import './styles/index.css'

let swRegistration: ServiceWorkerRegistration | undefined

setupStaleChunkReload()
setupResumeDeployCheck(() => swRegistration)

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
    swRegistration = registration
    if (!registration) return
    // Pick up new deploys even when the tab stays open.
    window.setInterval(() => {
      void registration.update()
    }, 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
)
