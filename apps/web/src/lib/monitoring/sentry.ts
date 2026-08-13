import * as Sentry from '@sentry/react'

let initialized = false

/**
 * Web error/performance monitoring (Phase 22 requirement 3). No-ops entirely
 * when VITE_SENTRY_DSN isn't set (local dev without a Sentry project
 * configured) rather than erroring — every other env var in this app is
 * optional-with-graceful-fallback (see lib/firebase.ts's App Check block),
 * this follows the same shape. `release` matches the source-map upload tag
 * the Vite plugin (vite.config.ts) uses, so a stack trace always resolves
 * against the exact build that produced it — see that plugin's comment for
 * why VITE_APP_VERSION (not a hardcoded string) is the join key.
 */
export function initMonitoring() {
  if (initialized) return
  initialized = true

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev',
    integrations: [Sentry.browserTracingIntegration()],
    // Conservative sampling — this is a mobile-first marketplace on Indian
    // mobile networks; full tracing on every session would be noisy and
    // costly for the value it adds at this phase. Tune once real traffic
    // volume is known.
    tracesSampleRate: 0.1,
    ignoreErrors: [
      // Browser extension / ad-blocker noise, not actionable.
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  })
}

/** Ties a crashed session back to the signed-in user, without any PII beyond the id GA4/Firebase Analytics already keys on — call from AuthProvider whenever auth state resolves. No-ops if Sentry was never initialised (no DSN). */
export function setMonitoringUser(userId: string | undefined) {
  Sentry.setUser(userId ? { id: userId } : null)
}

/** Tags every subsequent event in this browser tab with a correlationId (e.g. the order flow's, once createOrder returns one) — mirrors functions/src/monitoring/withSentry.ts's server-side tagging so a support engineer can pivot from a client error straight to the matching function logs. */
export function setMonitoringCorrelationId(correlationId: string | undefined) {
  Sentry.setTag('correlationId', correlationId ?? null)
}

export const MonitoringErrorBoundary = Sentry.ErrorBoundary
