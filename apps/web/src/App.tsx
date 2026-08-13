import { useEffect } from 'react'
import { AppProviders } from '@/app/providers'
import { AppRouter } from '@/app/router'
import { LanguageOnboardingDialog } from '@/components/onboarding/LanguageOnboardingDialog'
import { InstallPromptBanner } from '@/components/pwa/InstallPromptBanner'
import { MonitoringErrorBoundary } from '@/lib/monitoring/sentry'
import { useSessionMetaStore } from '@/stores/sessionMetaStore'

// Last-resort fallback if the whole app tree (including i18n/providers) has
// crashed — deliberately hardcoded English rather than t(), since whatever
// broke may be the very provider tree i18next depends on.
function CrashFallback() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-heading text-lg font-semibold text-alert">Something went wrong.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-tap rounded-[6px] border border-steel/20 px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
      >
        Reload
      </button>
    </div>
  )
}

// Zustand's `persist` rehydrates synchronously on module load in the browser,
// but React 18 StrictMode double-invokes effects in dev — guard with a
// module-level flag so a single real app load only ever counts as one
// session, in dev and prod alike.
let sessionCounted = false

export default function App() {
  const registerSessionStart = useSessionMetaStore((s) => s.registerSessionStart)

  useEffect(() => {
    if (sessionCounted) return
    sessionCounted = true
    registerSessionStart()
  }, [registerSessionStart])

  return (
    <MonitoringErrorBoundary fallback={<CrashFallback />}>
      <AppProviders>
        <AppRouter />
        <LanguageOnboardingDialog />
        <InstallPromptBanner />
      </AppProviders>
    </MonitoringErrorBoundary>
  )
}
