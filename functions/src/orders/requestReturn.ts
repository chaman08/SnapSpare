import {
  catalogPartSchema,
  listingSchema,
  type RequestReturnResult,
  requestReturnRequestSchema,
  returnSchema,
  subOrderSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getAppConfig } from '../checkout/appConfig.js'
import { appendTimelineEntry } from './timeline.js'
import { getReturnsConfig } from './returnsConfig.js'
import { enforceRateLimit } from '../util/rateLimit.js'
import { stripUndefined } from '../util/stripUndefined.js'

const DAY_MS = 24 * 60 * 60_000
const OPEN_RETURN_STATUSES = ['requested', 'approved', 'picked_up'] as const
/** Reasons that always require photo evidence — an unsubstantiated damage/defect/counterfeit claim isn't actionable for QC or a dispute later. */
const EVIDENCE_REQUIRED_REASONS = ['damaged_in_transit', 'defective', 'suspected_spurious'] as const

/**
 * Buyer-initiated return request, server-validated against the delivered
 * date + the listing's/category's/platform-default return window (config/app
 * and config/returns — see returnsConfig.ts), the non-returnable-category
 * gate (config/returns.nonReturnableSubcategorySlugs), and the
 * evidence-required-for-damage/defect/counterfeit rule. The rules-permitted
 * direct client create still exists unchanged for now (see
 * onReturnStatusChange.ts's doc comment) — this callable is the recommended
 * path and the one CartPage/OrderDetailPage's "Request return" action calls,
 * since it's the only path that actually checks the window/policy.
 */
export const requestReturn = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<RequestReturnResult> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const buyerId = request.auth.uid

  const parsed = requestReturnRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid return request is required')
  const input = parsed.data

  if ((EVIDENCE_REQUIRED_REASONS as readonly string[]).includes(input.reason) && input.images.length === 0) {
    throw new HttpsError('invalid-argument', 'evidence_required')
  }

  await enforceRateLimit(request, { name: 'requestReturn', perUidLimit: 15, perIpLimit: 30, windowMinutes: 1440 })

  const db = getFirestore()
  const [subOrderSnapshot, listingSnapshot, config, returnsConfig] = await Promise.all([
    db.collection('subOrders').doc(input.subOrderId).get(),
    db.collection('listings').doc(input.listingId).get(),
    getAppConfig(),
    getReturnsConfig(),
  ])

  if (!subOrderSnapshot.exists) throw new HttpsError('not-found', 'subOrder_not_found')
  const subOrder = subOrderSchema.parse({ id: subOrderSnapshot.id, ...subOrderSnapshot.data() })
  if (subOrder.buyerId !== buyerId) throw new HttpsError('permission-denied', 'not_your_order')
  if (subOrder.status !== 'delivered') throw new HttpsError('failed-precondition', 'not_delivered')

  const item = subOrder.items.find((line) => line.listingId === input.listingId)
  if (!item) throw new HttpsError('invalid-argument', 'item_not_in_suborder')
  if (input.qty > item.qty) throw new HttpsError('invalid-argument', 'qty_exceeds_line_item')

  const deliveredAt = subOrder.shipment?.deliveredAt
  if (deliveredAt === undefined) throw new HttpsError('failed-precondition', 'delivery_not_recorded')

  const listingParsed = listingSnapshot.exists
    ? listingSchema.safeParse({ id: listingSnapshot.id, ...listingSnapshot.data() })
    : undefined

  let subcategorySlug: string | undefined
  if (listingParsed?.success) {
    const catalogPartSnapshot = await db.collection('catalogParts').doc(listingParsed.data.partId).get()
    const catalogPart = catalogPartSnapshot.exists
      ? catalogPartSchema.safeParse({ id: catalogPartSnapshot.id, ...catalogPartSnapshot.data() })
      : undefined
    subcategorySlug = catalogPart?.success ? catalogPart.data.subcategorySlug : undefined
  }

  if (subcategorySlug && returnsConfig.nonReturnableSubcategorySlugs.includes(subcategorySlug)) {
    throw new HttpsError('failed-precondition', 'category_not_returnable')
  }

  const windowDays =
    (subcategorySlug ? returnsConfig.categoryReturnWindowDaysOverride[subcategorySlug] : undefined) ??
    (listingParsed?.success ? listingParsed.data.returnWindowDays : undefined) ??
    config.defaultReturnWindowDays
  if (Date.now() > deliveredAt + windowDays * DAY_MS) {
    throw new HttpsError('failed-precondition', 'return_window_closed')
  }

  const existingOpen = await db
    .collection('returns')
    .where('subOrderId', '==', input.subOrderId)
    .where('listingId', '==', input.listingId)
    .where('status', 'in', [...OPEN_RETURN_STATUSES])
    .limit(1)
    .get()
  if (!existingOpen.empty) throw new HttpsError('already-exists', 'return_already_open')

  const now = Date.now()
  const returnRef = db.collection('returns').doc()
  const { id: _id, ...returnDoc } = returnSchema.parse({
    id: returnRef.id,
    orderId: subOrder.orderId,
    subOrderId: subOrder.id,
    buyerId,
    sellerId: subOrder.sellerId,
    listingId: input.listingId,
    qty: input.qty,
    reason: input.reason,
    reasonNotes: input.reasonNotes,
    resolutionPreference: input.resolutionPreference,
    status: 'requested',
    images: input.images,
    videoPath: input.videoPath,
    timeline: appendTimelineEntry([], 'requested', { type: 'buyer', id: buyerId }, undefined, now),
    requestedAt: now,
    createdAt: now,
    updatedAt: now,
  })
  await returnRef.set(stripUndefined(returnDoc))

  return { returnId: returnRef.id }
})
