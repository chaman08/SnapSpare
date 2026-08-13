import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { toast } from 'sonner'
import { app } from './firebase'

export type PushPermissionOutcome = 'granted' | 'denied' | 'unsupported'

/**
 * Prompts for Notification permission and — if granted — registers the
 * resulting FCM token via the registerFcmToken callable. Callers decide
 * *when* to invoke this (see OrderDetailPage's PushPermissionPrompt — never
 * on cold page load, only after the buyer's first order).
 *
 * Reuses the single app-wide service worker (see registerServiceWorker.ts /
 * scripts/generate-sw.mjs) rather than registering a separate one — a page
 * can only be controlled by one SW at a time, so FCM's background handler
 * and the offline-caching logic both live in that same generated file.
 * `register()` with the same URL that's already registered just resolves
 * to the existing registration, so calling it again here is safe even if
 * registerServiceWorker() ran first (the common case).
 */
export async function requestPushPermission(
  onToken: (token: string) => Promise<void>,
): Promise<PushPermissionOutcome> {
  if (!(await isSupported())) return 'unsupported'
  if (!('serviceWorker' in navigator)) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) return 'unsupported'

  const registration = await navigator.serviceWorker.register('/sw.js')
  const messaging = getMessaging(app)
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
  if (!token) return 'denied'

  await onToken(token)
  return 'granted'
}

/** Foreground pushes don't show a system notification by themselves (only background/SW ones do) — surface them as a toast instead, reusing the Toaster already mounted in providers.tsx. */
export async function initForegroundPushToasts(): Promise<void> {
  if (!(await isSupported())) return
  const messaging = getMessaging(app)
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title
    const body = payload.notification?.body
    if (!title) return
    toast(title, { description: body })
  })
}
