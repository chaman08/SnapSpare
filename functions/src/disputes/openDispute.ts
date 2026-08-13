import {
  type OpenDisputeResult,
  openDisputeRequestSchema,
  returnSchema,
  sellerSchema,
  warrantyClaimSchema,
} from '@snapspare/shared'
import { type Firestore, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireUid } from '../orders/authz.js'
import { getReturnsConfig } from '../orders/returnsConfig.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { enforceRateLimit } from '../util/rateLimit.js'
import { stripUndefined } from '../util/stripUndefined.js'

/**
 * Buyer or seller escalates a disagreement to admin (design brief item 7):
 * a QC-disputed return, a rejected/brand-escalated warranty claim the buyer
 * still disagrees with, or a generic order/subOrder dispute. Seeds the
 * evidence timeline from the linked return/claim's existing images so the
 * admin doesn't start from zero, and sets the SLA clock from
 * config/returns.disputeSlaHours. No admin push notification is sent here —
 * same convention as spuriousReports (Phase 17): admins work the
 * /admin/disputes live-query queue rather than being individually paged;
 * sendDisputeSlaBreachWarnings.ts is the one exception, since a breach is
 * urgent enough to page every admin directly.
 */
export const openDispute = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<OpenDisputeResult> => {
  const uid = requireUid(request)
  const sellerId = request.auth?.token.sellerId as string | undefined

  const parsed = openDisputeRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid dispute is required')
  const input = parsed.data

  await enforceRateLimit(request, { name: 'openDispute', perUidLimit: 10, perIpLimit: 20, windowMinutes: 1440 })

  const db = getFirestore()

  const existingOpen = await db
    .collection('disputes')
    .where('subOrderId', '==', input.subOrderId)
    .where('status', 'in', ['open', 'under_review'])
    .limit(1)
    .get()
  if (!existingOpen.empty) throw new HttpsError('already-exists', 'dispute_already_open')

  let buyerId: string
  let disputeSellerId: string
  let evidence: { url: string; uploadedBy: string; uploadedAt: number; note?: string }[] = []

  if (input.type === 'return_qc') {
    if (!input.returnId) throw new HttpsError('invalid-argument', 'returnId is required')
    const snapshot = await db.collection('returns').doc(input.returnId).get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'return_not_found')
    const ret = returnSchema.parse({ id: snapshot.id, ...snapshot.data() })
    if (ret.status !== 'qc_disputed') throw new HttpsError('failed-precondition', 'return_not_disputed')
    buyerId = ret.buyerId
    disputeSellerId = ret.sellerId
    evidence = [
      ...ret.images.map((url) => ({ url, uploadedBy: ret.buyerId, uploadedAt: ret.requestedAt })),
      ...(ret.qc?.photos ?? []).map((url) => ({ url, uploadedBy: ret.qc?.decidedBy ?? 'system', uploadedAt: ret.qc?.decidedAt ?? ret.requestedAt })),
    ]
  } else if (input.type === 'warranty_claim') {
    if (!input.warrantyClaimId) throw new HttpsError('invalid-argument', 'warrantyClaimId is required')
    const snapshot = await db.collection('warrantyClaims').doc(input.warrantyClaimId).get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'claim_not_found')
    const claim = warrantyClaimSchema.parse({ id: snapshot.id, ...snapshot.data() })
    if (claim.status !== 'rejected' && claim.status !== 'escalated_to_brand') {
      throw new HttpsError('failed-precondition', 'claim_not_disputable')
    }
    buyerId = claim.buyerId
    disputeSellerId = claim.sellerId
    evidence = claim.evidenceImages.map((url) => ({ url, uploadedBy: claim.buyerId, uploadedAt: claim.claimedAt }))
  } else {
    const subOrderSnapshot = await db.collection('subOrders').doc(input.subOrderId).get()
    if (!subOrderSnapshot.exists) throw new HttpsError('not-found', 'subOrder_not_found')
    const subOrder = subOrderSnapshot.data() as { buyerId?: string; sellerId?: string }
    if (!subOrder.buyerId || !subOrder.sellerId) throw new HttpsError('failed-precondition', 'subOrder_not_found')
    buyerId = subOrder.buyerId
    disputeSellerId = subOrder.sellerId
  }

  if (uid !== buyerId && sellerId !== disputeSellerId) {
    throw new HttpsError('permission-denied', 'not_a_participant')
  }
  const openedBy = uid === buyerId ? ('buyer' as const) : ('seller' as const)

  const returnsConfig = await getReturnsConfig()
  const now = Date.now()

  const ref = db.collection('disputes').doc()
  await ref.set(
    stripUndefined({
      id: ref.id,
      type: input.type,
      returnId: input.returnId,
      warrantyClaimId: input.warrantyClaimId,
      orderId: input.orderId,
      subOrderId: input.subOrderId,
      buyerId,
      sellerId: disputeSellerId,
      openedBy,
      reasonNotes: input.reasonNotes,
      evidence,
      status: 'open',
      slaBreachAt: now + returnsConfig.disputeSlaHours * 60 * 60_000,
      createdAt: now,
      updatedAt: now,
    }),
  )

  const counterpartyUserId =
    openedBy === 'buyer' ? await resolveSellerOwnerUserId(db, disputeSellerId) : buyerId
  if (counterpartyUserId) {
    await queueNotificationDirect(db, {
      userId: counterpartyUserId,
      type: 'dispute_opened',
      language: await resolveUserLanguage(db, counterpartyUserId),
      orderId: input.orderId,
      subOrderId: input.subOrderId,
      disputeId: ref.id,
    })
  }

  return { disputeId: ref.id }
})

async function resolveSellerOwnerUserId(db: Firestore, sellerId: string): Promise<string | undefined> {
  const snapshot = await db.collection('sellers').doc(sellerId).get()
  if (!snapshot.exists) return undefined
  const seller = sellerSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
  return seller.success ? seller.data.ownerUserId : undefined
}
