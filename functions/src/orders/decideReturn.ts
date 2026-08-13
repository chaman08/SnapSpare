import {
  computeLineRefund,
  type DecideReturnResult,
  decideReturnRequestSchema,
  returnSchema,
  sellerSchema,
  subOrderSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from './authz.js'
import { getReturnsConfig } from './returnsConfig.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'
import { appendTimelineEntry } from './timeline.js'
import { provider } from '../shipping/provider.js'
import { resolveSellerOrigin } from '../shipping/resolveSellerOrigin.js'
import type { ShippingContactAddress } from '../shipping/shippingProvider.js'

/**
 * Seller (or admin) decision on a `requested` return — replaces the old
 * direct-client Firestore update (firestore.rules no longer allows it, see
 * that file's header comment on the `returns` collection) now that
 * "approve" has a real side effect: booking a reverse pickup via the
 * shipping adapter. `sellerFault`/`returnShippingDeductionPaise` are
 * computed here from config/returns' buyer-fault reason list, and the
 * reverse-pickup provider call runs *after* the state is loaded but the
 * write itself is a single non-transactional update on just the `returns`
 * doc — cheap enough that a mid-flight failure just leaves the return
 * `requested` and the seller can retry, rather than needing a two-phase
 * commit/rollback dance like refundReturn.ts's money-moving path.
 */
export const decideReturn = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<DecideReturnResult> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const sellerId = request.auth.token.sellerId as string | undefined
  const admin = isAdminRequest(request)
  if (!sellerId && !admin) throw new HttpsError('permission-denied', 'seller_or_admin_only')

  const parsed = decideReturnRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid decision is required')
  const input = parsed.data

  const db = getFirestore()
  const returnRef = db.collection('returns').doc(input.returnId)
  const returnSnapshot = await returnRef.get()
  if (!returnSnapshot.exists) throw new HttpsError('not-found', 'return_not_found')
  const ret = returnSchema.parse({ id: returnSnapshot.id, ...returnSnapshot.data() })
  if (!admin && ret.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_return')
  if (ret.status !== 'requested') throw new HttpsError('failed-precondition', 'return_not_requested')

  const now = Date.now()
  const actor = admin ? { type: 'admin' as const, id: request.auth.uid } : { type: 'seller' as const, id: sellerId }

  if (input.decision === 'rejected') {
    await returnRef.update(
      stripUndefined({
        status: 'rejected',
        resolvedAt: now,
        timeline: appendTimelineEntry(ret.timeline, 'rejected', actor, input.note, now),
        updatedAt: now,
      }),
    )
    if (admin) {
      await writeAuditLog({
        request,
        action: 'return.reject',
        targetType: 'returns',
        targetId: ret.id,
        before: { status: ret.status },
        after: { status: 'rejected' },
        note: input.note,
      })
    }
    return { returnId: ret.id, status: 'rejected' }
  }

  // decision === 'approved'
  const [returnsConfig, subOrderSnapshot, sellerSnapshot] = await Promise.all([
    getReturnsConfig(),
    db.collection('subOrders').doc(ret.subOrderId).get(),
    db.collection('sellers').doc(ret.sellerId).get(),
  ])
  if (!subOrderSnapshot.exists) throw new HttpsError('failed-precondition', 'subOrder_not_found')
  if (!sellerSnapshot.exists) throw new HttpsError('failed-precondition', 'seller_not_found')
  const subOrder = subOrderSchema.parse({ id: subOrderSnapshot.id, ...subOrderSnapshot.data() })
  const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })

  const item = subOrder.items.find((line) => line.listingId === ret.listingId)
  if (!item) throw new HttpsError('failed-precondition', 'item_not_in_suborder')

  const dropAddress = await resolveSellerOrigin(seller)
  if (!dropAddress) throw new HttpsError('failed-precondition', 'seller_origin_not_set')

  const pickupAddress: ShippingContactAddress = {
    name: subOrder.shippingAddress.contactName,
    phone: subOrder.shippingAddress.contactPhone,
    addressLine1: subOrder.shippingAddress.line1,
    addressLine2: subOrder.shippingAddress.line2,
    city: subOrder.shippingAddress.city,
    state: subOrder.shippingAddress.state,
    pincode: subOrder.shippingAddress.pincode,
  }

  const sellerFault = !returnsConfig.buyerFaultReasons.includes(ret.reason)
  const declaredValuePaise = computeLineRefund(item, ret.qty).totalPaise

  const pickupResult = await provider.createReversePickup({
    returnId: ret.id,
    subOrderId: ret.subOrderId,
    orderId: ret.orderId,
    sellerId: ret.sellerId,
    pickupAddress,
    dropAddress,
    items: [{ name: item.title, sku: item.sku, qty: ret.qty, unitPricePaise: item.unitPricePaise }],
    package: { weightGrams: 500 * ret.qty },
    declaredValuePaise,
  })

  await returnRef.update(
    stripUndefined({
      status: 'approved',
      sellerFault,
      returnShippingDeductionPaise: sellerFault ? undefined : returnsConfig.buyerFaultShippingFeePaise,
      pickup: stripUndefined({
        providerShipmentId: pickupResult.providerShipmentId,
        providerOrderId: pickupResult.providerOrderId,
        awb: pickupResult.awb,
        courier: pickupResult.courier,
        scheduledAt: now,
      }),
      timeline: appendTimelineEntry(ret.timeline, 'approved', actor, input.note, now),
      updatedAt: now,
    }),
  )
  if (admin) {
    await writeAuditLog({
      request,
      action: 'return.approve',
      targetType: 'returns',
      targetId: ret.id,
      before: { status: ret.status },
      after: { status: 'approved', sellerFault },
      note: input.note,
    })
  }

  return { returnId: ret.id, status: 'approved' }
})
