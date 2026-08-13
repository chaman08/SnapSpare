import type { AnalyticsEventName, AnalyticsEventPayloadMap, BuyerType } from '@snapspare/shared'
import { analyticsEventSchemas, FUNNEL_EVENT_NAMES } from '@snapspare/shared'
import { type Analytics, getAnalytics, isSupported, logEvent, setAnalyticsCollectionEnabled } from 'firebase/analytics'
import { httpsCallable } from 'firebase/functions'
import { app, functions } from '@/lib/firebase'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let firebaseAnalytics: Analytics | undefined
let initialized = false

/**
 * Boots GA4 (gtag.js, script-injected only when a measurement id is
 * configured — never in the emulator/dev-without-key case) and Firebase
 * Analytics side by side, once, from main.tsx. Both receive the exact same
 * events via track() below — GA4 for the marketing/funnel reports this phase
 * asks for, Firebase Analytics because it's already bundled with the rest of
 * this app's Firebase SDK and gives free DebugView during development.
 */
export function initAnalytics() {
  if (initialized) return
  initialized = true

  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined
  if (measurementId && typeof document !== 'undefined') {
    window.dataLayer = window.dataLayer ?? []
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args)
    }
    window.gtag('js', new Date())
    window.gtag('config', measurementId, { anonymize_ip: true, send_page_view: false })

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    document.head.appendChild(script)
  }

  void isSupported()
    .then((supported) => {
      if (!supported) return
      firebaseAnalytics = getAnalytics(app)
      setAnalyticsCollectionEnabled(firebaseAnalytics, true)
    })
    .catch(() => {
      // Analytics unsupported in this environment (e.g. SSR/test/no-cookie) — silently skip, never block app boot over telemetry.
    })
}

/** Fire-and-forget: every network hop here is best-effort, never awaited by the caller and never throws into product code. */
const logFunnelEventCallable = httpsCallable<{ step: string; buyerType?: BuyerType }, { ok: boolean }>(
  functions,
  'logFunnelEvent',
)

export interface TrackOptions {
  /** Only meaningful for funnel-step events — segments the daily funnel/cohort rollups. Omit for guest/unknown. */
  buyerType?: BuyerType
}

/**
 * The one function product code calls to emit an analytics event — see
 * packages/shared/src/analytics/events.ts for the full typed catalog.
 * `name`/`payload` are compile-time checked against that catalog so an event
 * name typo or a payload shape drift is a build error, not a silent gap
 * discovered months later in a funnel report. Dev-only runtime validation
 * (zod) double-checks the same thing for anything the type system can't
 * catch (e.g. an object built dynamically), logging loudly instead of
 * throwing — a broken analytics call should never break the page.
 */
export function track<K extends AnalyticsEventName>(name: K, payload: AnalyticsEventPayloadMap[K], options?: TrackOptions) {
  if (import.meta.env.DEV) {
    const result = analyticsEventSchemas[name].safeParse(payload)
    if (!result.success) {
      console.error(`[analytics] "${name}" payload failed validation`, result.error.flatten(), payload)
    }
  }

  try {
    window.gtag?.('event', name, payload)
    // `name` is one of our own catalog's literal strings, several of which
    // (search, purchase, refund, ...) happen to collide with GA4's own
    // reserved event names — firebase/analytics's logEvent has narrow
    // per-name overloads for those, none of which match our payload shape.
    // The runtime call is identical either way (it's just `logEvent(analytics, name, params)`); the cast only relaxes the compile-time overload match.
    if (firebaseAnalytics) (logEvent as (analytics: typeof firebaseAnalytics, name: string, params?: Record<string, unknown>) => void)(firebaseAnalytics, name, payload)
  } catch {
    // Never let a telemetry failure surface to the user.
  }

  if ((FUNNEL_EVENT_NAMES as readonly string[]).includes(name)) {
    logFunnelEventCallable({ step: name, buyerType: options?.buyerType }).catch(() => {
      // Best-effort counter — a dropped beacon just slightly undercounts a day's funnel, never worth retrying against the user's session.
    })
  }
}
