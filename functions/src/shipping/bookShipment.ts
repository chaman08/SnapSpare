import { type BookShipmentResult, bookShipmentRequestSchema, listingSchema, sellerSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from '../orders/authz.js'
import { loadSubOrderContext } from '../orders/loadContext.js'
import { provider } from './provider.js'
import { resolveSellerOrigin } from './resolveSellerOrigin.js'
import type { ShippingContactAddress } from './shippingProvider.js'

/**
 * Books the courier shipment for an already-packed subOrder (design brief
 * item 5) — a real Shiprocket/mock `createShipment` call, distinct from
 * (and a prerequisite for) `shipSubOrder.ts`'s status transition. Doesn't
 * touch `subOrder.status`: booking a courier isn't "shipped", and
 * `shipSubOrder` still owns that transition, now typically called with the
 * AWB this booking returns instead of one the seller typed by hand.
 */
export const bookShipment = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<BookShipmentResult> => {
  const sellerId = requireSellerId(request)
  const parsed = bookShipmentRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid subOrderId is required')

  const db = getFirestore()
  const ctx = await db.runTransaction((tx) => loadSubOrderContext(tx, db, parsed.data.subOrderId))
  if (ctx.subOrder.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_suborder')
  if (ctx.subOrder.status !== 'packed') throw new HttpsError('failed-precondition', 'suborder_not_packed')

  const sellerSnapshot = await db.collection('sellers').doc(sellerId).get()
  if (!sellerSnapshot.exists) throw new HttpsError('failed-precondition', 'seller_not_found')
  const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })

  const pickupAddress = await resolveSellerOrigin(seller)
  if (!pickupAddress) throw new HttpsError('failed-precondition', 'seller_origin_not_set')

  const listingSnapshots = await Promise.all(
    ctx.subOrder.items.map((item) => db.collection('listings').doc(item.listingId).get()),
  )
  const totalWeightGrams = ctx.subOrder.items.reduce((sum, item, index) => {
    const snapshot = listingSnapshots[index]
    const listing = snapshot?.exists ? listingSchema.safeParse({ id: snapshot.id, ...snapshot.data() }) : undefined
    const weightGrams = listing?.success ? (listing.data.weightGrams ?? 500) : 500
    return sum + weightGrams * item.qty
  }, 0)

  const deliveryAddress: ShippingContactAddress = {
    name: ctx.subOrder.shippingAddress.contactName,
    phone: ctx.subOrder.shippingAddress.contactPhone,
    addressLine1: ctx.subOrder.shippingAddress.line1,
    addressLine2: ctx.subOrder.shippingAddress.line2,
    city: ctx.subOrder.shippingAddress.city,
    state: ctx.subOrder.shippingAddress.state,
    pincode: ctx.subOrder.shippingAddress.pincode,
  }

  const result = await provider.createShipment({
    subOrderId: ctx.subOrder.id,
    orderId: ctx.order.id,
    sellerId,
    pickupAddress,
    deliveryAddress,
    items: ctx.subOrder.items.map((item) => ({
      name: item.title,
      sku: item.sku,
      qty: item.qty,
      unitPricePaise: item.unitPricePaise,
    })),
    package: { weightGrams: totalWeightGrams },
    codAmountPaise: ctx.order.paymentMethod === 'cod' ? ctx.subOrder.totalPaise : undefined,
    declaredValuePaise: ctx.subOrder.subtotalPaise,
  })

  await ctx.subOrderRef.update({
    shipment: {
      ...ctx.subOrder.shipment,
      providerShipmentId: result.providerShipmentId,
      providerOrderId: result.providerOrderId,
      ...(result.awb ? { awb: result.awb } : {}),
      ...(result.courier ? { courier: result.courier } : {}),
    },
    updatedAt: Date.now(),
  })

  return {
    subOrderId: ctx.subOrder.id,
    providerShipmentId: result.providerShipmentId,
    providerOrderId: result.providerOrderId,
    awb: result.awb,
    courier: result.courier,
  }
})
