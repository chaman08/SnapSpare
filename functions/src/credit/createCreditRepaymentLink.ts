import {
  type CreateCreditRepaymentLinkResult,
  createCreditRepaymentLinkRequestSchema,
  creditAccountSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getAppConfig } from '../checkout/appConfig.js'
import { createPaymentLink } from '../checkout/razorpayClient.js'
import { RAZORPAY_KEY_SECRET } from '../checkout/secrets.js'

/**
 * Creates a Razorpay Payment Link for a buyer to repay their Khata
 * outstanding balance — design brief item 7's "repayment via a payment link
 * that credits the account." The `notes.purpose: 'credit_repayment'` this
 * sets is what routes the eventual `payment.captured` webhook to
 * applyCreditRepayment.ts instead of the normal order-confirmation path.
 */
export const createCreditRepaymentLink = onCall(
  { enforceAppCheck: true, region: 'asia-south1', secrets: [RAZORPAY_KEY_SECRET] },
  async (request): Promise<CreateCreditRepaymentLinkResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const buyerId = request.auth.uid

    const parsed = createCreditRepaymentLinkRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid amountPaise is required')

    const db = getFirestore()
    const creditSnapshot = await db.collection('creditAccounts').where('buyerId', '==', buyerId).limit(1).get()
    const creditDoc = creditSnapshot.docs[0]
    if (!creditDoc) throw new HttpsError('failed-precondition', 'no_credit_account')
    const credit = creditAccountSchema.parse({ id: creditDoc.id, ...creditDoc.data() })
    if (parsed.data.amountPaise > credit.outstandingPaise) {
      throw new HttpsError('invalid-argument', 'amount_exceeds_outstanding')
    }

    const config = await getAppConfig()
    if (!config.razorpayKeyId) throw new HttpsError('internal', 'payment_gateway_unavailable')

    const link = await createPaymentLink({
      keyId: config.razorpayKeyId,
      keySecret: RAZORPAY_KEY_SECRET.value(),
      amountPaise: parsed.data.amountPaise,
      description: 'SnapSpare Khata repayment',
      notes: { purpose: 'credit_repayment', creditAccountId: credit.id, buyerId },
    })

    return { shortUrl: link.short_url }
  },
)
