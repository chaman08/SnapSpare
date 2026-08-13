import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import '@/lib/i18n'
import { initAnalytics } from '@/lib/analytics/track'
import { initLocaleFontLoader } from '@/lib/localeFonts'
import { initMonitoring } from '@/lib/monitoring/sentry'
import { registerServiceWorker } from '@/lib/registerServiceWorker'
import { initLowDataModeAutoDetect } from '@/stores/preferencesStore'
import '@/styles/globals.css'

initMonitoring()
initLocaleFontLoader()
initLowDataModeAutoDetect()
initAnalytics()
void registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
