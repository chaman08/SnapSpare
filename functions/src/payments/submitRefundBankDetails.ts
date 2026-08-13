import { ifscSchema, orderSchema, returnSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { enforceRateLimit } from '../util/rateLimit.js'

const submitRefundBankDetailsRequestSchema = z.object({
  returnId: z.string().min(1),
  accountHolderName: z.string().min(1),
  accountNumber: z.string().min(4),
  ifsc: ifscSchema,
  bankName: z.string().min(1),
})

export interface SubmitRefundBankDetailsResult {
  refundBankDetailId: string
}

/**
 * Buyer-submitted bank account for a COD refund (design brief item 2: "bank
 * transfer (payout API) for COD, with a bank-detail collection flow") — a
 * COD order has no card/UPI/netbanking instrument to reverse a refund to, so
 * refundEngine.ts needs this on file before it can call the payout provider.
 * Callable once per return; a second submission for the same return replaces
 * the first (still 'pending') rather than creating a duplicate, so a buyer
 * fixing a typo doesn't leave stale bank details behind.
 */
export const submitRefundBankDetails = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<SubmitRefundBankDetailsResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const buyerId = request.auth.uid

    const parsed = submitRefundBankDetailsRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Valid bank details are required')
    const input = parsed.data

    // Low limits: this is a sensitive-data submission endpoint, not a
    // browse/read action — a legitimate buyer submits it once or twice per
    // return (typo fix), never dozens of times.
    await enforceRateLimit(request, { name: 'submitRefundBankDetails', perUidLimit: 5, perIpLimit: 10, windowMinutes: 1440 })

    const db = getFirestore()
    const returnSnapshot = await db.collection('returns').doc(input.returnId).get()
    if (!returnSnapshot.exists) throw new HttpsError('not-found', 'return_not_found')
    const ret = returnSchema.parse({ id: returnSnapshot.id, ...returnSnapshot.data() })
    if (ret.buyerId !== buyerId) throw new HttpsError('permission-denied', 'not_your_return')
    if (ret.status === 'refunded' || ret.status === 'closed') {
      throw new HttpsError('failed-precondition', 'return_already_resolved')
    }

    const orderSnapshot = await db.collection('orders').doc(ret.orderId).get()
    if (!orderSnapshot.exists) throw new HttpsError('failed-precondition', 'order_not_found')
    const order = orderSchema.parse({ id: orderSnapshot.id, ...orderSnapshot.data() })
    if (order.paymentMethod !== 'cod') {
      throw new HttpsError('failed-precondition', 'bank_details_only_needed_for_cod')
    }

    const now = Date.now()
    const existing = await db
      .collection('refundBankDetails')
      .where('returnId', '==', input.returnId)
      .where('status', '==', 'pending')
      .limit(1)
      .get()

    const ref = existing.docs[0]?.ref ?? db.collection('refundBankDetails').doc()
    await ref.set({
      buyerId,
      returnId: input.returnId,
      accountHolderName: input.accountHolderName,
      accountNumber: input.accountNumber,
      ifsc: input.ifsc,
      bankName: input.bankName,
      status: 'pending',
      createdAt: existing.docs[0] ? existing.docs[0].data().createdAt : now,
      updatedAt: now,
    })

    return { refundBankDetailId: ref.id }
  },
)
