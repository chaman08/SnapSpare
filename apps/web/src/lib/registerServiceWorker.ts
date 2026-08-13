/**
 * Registers the app-wide service worker (generated at build/dev time by
 * scripts/generate-sw.mjs into public/sw.js) so offline caching is active
 * from the very first load, independent of whether the buyer ever opts
 * into push notifications (see pushNotifications.ts, which reuses this
 * same registration for FCM).
 */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return // avoid caching against the Vite dev server's unbundled modules

  try {
    await navigator.serviceWorker.register('/sw.js')
  } catch {
    // Offline support is a progressive enhancement — a registration failure
    // (e.g. an unusual hosting setup) should never block the app itself.
  }
}
