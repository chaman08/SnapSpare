import { type NotificationChannel, type NotificationType, notificationPreferencesSchema } from '@snapspare/shared'
import type { Firestore } from 'firebase-admin/firestore'

const IST_OFFSET_MS = 5.5 * 60 * 60_000
const DAY_MS = 24 * 60 * 60_000
const QUIET_HOURS_START_IST = 21
const QUIET_HOURS_END_IST = 9

/**
 * Notification types that respect opt-out + quiet hours. Everything else
 * (order lifecycle, payments, returns, credit, seller onboarding, RFQ,
 * SLA/low-stock ops alerts) is transactional and always sends — the hard
 * rule from the Phase 16 design brief.
 */
const MARKETING_TYPES: ReadonlySet<NotificationType> = new Set([
  'price_drop',
  'back_in_stock',
  'abandoned_cart',
  // Phase 17: buyer-initiated-purchase-triggered but not urgent/transactional —
  // behaves like abandoned_cart (opt-out/quiet-hours/rate-cap relevant).
  'review_request',
])

export function isMarketingType(type: NotificationType): boolean {
  return MARKETING_TYPES.has(type)
}

/** IST has no DST, so a fixed +5:30 offset is exact — no timezone library needed. */
function istHourOfDay(nowMs: number): number {
  const istMs = nowMs + IST_OFFSET_MS
  return Math.floor((istMs % DAY_MS) / (60 * 60_000))
}

/** True between 21:00 and 09:00 IST (inclusive start, exclusive end wraps past midnight). */
export function isQuietHoursIST(nowMs: number): boolean {
  const hour = istHourOfDay(nowMs)
  return hour >= QUIET_HOURS_START_IST || hour < QUIET_HOURS_END_IST
}

/** The next 09:00 IST at or after `nowMs` — where a marketing send made during quiet hours gets deferred to, rather than dropped. */
export function nextQuietHoursEndIST(nowMs: number): number {
  const istMs = nowMs + IST_OFFSET_MS
  const dayStartIstMs = istMs - (istMs % DAY_MS)
  const todayNineAmIstMs = dayStartIstMs + QUIET_HOURS_END_IST * 60 * 60_000
  const nineAmIstMs = todayNineAmIstMs > istMs ? todayNineAmIstMs : todayNineAmIstMs + DAY_MS
  return nineAmIstMs - IST_OFFSET_MS
}

export interface ResolvedNotificationPreferences {
  channels: Record<NotificationChannel, boolean>
  marketingOptOut: boolean
}

const DEFAULT_PREFERENCES: ResolvedNotificationPreferences = {
  channels: { push: true, sms: true, whatsapp: true, email: true },
  marketingOptOut: false,
}

/** No preferences doc yet == every channel opted in, marketing not opted out — matches notificationPreferencesSchema's own defaults. */
export async function resolveNotificationPreferences(
  db: Firestore,
  userId: string,
): Promise<ResolvedNotificationPreferences> {
  const snapshot = await db.collection('notificationPreferences').doc(userId).get()
  if (!snapshot.exists) return DEFAULT_PREFERENCES

  const parsed = notificationPreferencesSchema.safeParse({ id: snapshot.id, userId, ...snapshot.data() })
  if (!parsed.success) return DEFAULT_PREFERENCES

  return { channels: parsed.data.channels, marketingOptOut: parsed.data.marketingOptOut }
}
