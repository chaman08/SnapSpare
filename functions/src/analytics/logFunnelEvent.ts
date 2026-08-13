import { logFunnelEventRequestSchema } from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onCall } from 'firebase-functions/v2/https'
import { istDateString } from '../util/istDate.js'

/**
 * Increments today's funnel counter for one step (Phase 22 requirement 2's
 * funnel dashboard). Called by apps/web/src/lib/analytics/track.ts for every
 * FUNNEL_EVENT_NAMES event, fire-and-forget from the client — deliberately
 * unauthenticated (guests search/browse long before signing in, and the
 * funnel's whole point is measuring that top-of-funnel drop-off) with the
 * request payload schema-validated to keep the write surface narrow. The
 * `purchase` step's daily count is overwritten nightly by
 * reconcileFunnelPurchases.ts from the authoritative `orders` collection —
 * this callable still increments it for same-day dashboard freshness, it's
 * just not the number of record for that step by the next morning.
 */
export const logFunnelEvent = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ ok: boolean }> => {
  const parsed = logFunnelEventRequestSchema.safeParse(request.data)
  if (!parsed.success) return { ok: false }
  const { step, buyerType } = parsed.data

  const now = Date.now()
  const date = istDateString(now)
  const segment = buyerType ?? 'all'
  const docId = `${date}__${segment}`

  await getFirestore()
    .collection('analyticsFunnelDaily')
    .doc(docId)
    .set({ date, segment, updatedAt: now, [`steps.${step}`]: FieldValue.increment(1) }, { merge: true })

  return { ok: true }
})
