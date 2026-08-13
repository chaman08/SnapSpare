import { type GenerateShippingLabelResult, generateShippingLabelRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from '../orders/authz.js'
import { loadSubOrderContext } from '../orders/loadContext.js'
import { provider } from './provider.js'

const LABEL_URL_TTL_MS = 7 * 24 * 60 * 60_000

/**
 * Generates (or regenerates) the courier label PDF for a booked shipment
 * (design brief item 5), stores it in Storage at
 * `sellers/{sellerId}/labels/{subOrderId}.pdf`, and hands back a signed
 * read URL — writable only via this Cloud Function's Admin SDK access
 * (see storage.rules), never a direct client upload. The URL expires; a
 * seller re-opening the "Download label" link after it has needs to call
 * this again, which just re-signs (a re-fetch from the provider is cheap
 * and keeps this idempotent rather than caching a URL that could go stale).
 */
export const generateShippingLabel = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<GenerateShippingLabelResult> => {
    const sellerId = requireSellerId(request)
    const parsed = generateShippingLabelRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid subOrderId is required')

    const db = getFirestore()
    const ctx = await db.runTransaction((tx) => loadSubOrderContext(tx, db, parsed.data.subOrderId))
    if (ctx.subOrder.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_suborder')
    const providerShipmentId = ctx.subOrder.shipment?.providerShipmentId
    if (!providerShipmentId) throw new HttpsError('failed-precondition', 'shipment_not_booked')

    const { labelBytes, contentType } = await provider.generateLabel(providerShipmentId)

    const filePath = `sellers/${sellerId}/labels/${ctx.subOrder.id}.pdf`
    const file = getStorage().bucket().file(filePath)
    await file.save(labelBytes, { contentType })
    const [labelUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + LABEL_URL_TTL_MS })

    const now = Date.now()
    await ctx.subOrderRef.update({
      shipment: { ...ctx.subOrder.shipment, labelUrl, labelGeneratedAt: now },
      updatedAt: now,
    })

    return { subOrderId: ctx.subOrder.id, labelUrl }
  },
)
