import * as Sentry from '@sentry/node'

let initialized = false

/**
 * Cloud Functions error/performance monitoring (Phase 22 requirement 3).
 * Called once from index.ts, before any function export runs — no-ops when
 * SENTRY_DSN isn't set in the function's environment (`firebase functions:secrets:set`
 * or `--set-env-vars`), same "optional, graceful no-op" shape as the web
 * app's lib/monitoring/sentry.ts. `release` should be set to the deployed
 * commit SHA (e.g. via `--set-env-vars SENTRY_RELEASE=$(git rev-parse HEAD)`
 * in CI) so a Cloud Function stack trace resolves against the exact source
 * that produced it, same join key the web build's source-map upload uses.
 */
export function initSentry(): void {
  if (initialized) return
  initialized = true

  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.GCLOUD_PROJECT ?? 'production',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0.1,
  })
}

export { Sentry }
