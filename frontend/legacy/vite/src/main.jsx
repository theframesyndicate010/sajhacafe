import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary from './components/common/AppErrorBoundary.jsx'
import { BusinessProvider } from './context/BusinessContext.jsx'

const PWA_UPDATE_READY_EVENT = 'pwa:update-ready'

const dispatchPwaUpdateReady = (registration) => {
  if (!registration?.waiting) {
    return
  }

  window.dispatchEvent(
    new CustomEvent(PWA_UPDATE_READY_EVENT, {
      detail: { registration },
    }),
  )
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')

      dispatchPwaUpdateReady(registration)

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing
        if (!installingWorker) {
          return
        }

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            dispatchPwaUpdateReady(registration)
          }
        })
      })

      window.setInterval(() => {
        registration.update().catch(() => {})
      }, 60 * 60 * 1000)
    } catch (error) {
      console.error('Service worker registration failed:', error)
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <BusinessProvider>
        <App />
      </BusinessProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
