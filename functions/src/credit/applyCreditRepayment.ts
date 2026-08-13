import { creditAccountSchema } from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { queueNotification } from '../orders/notify.js'

export interface CreditRepaymentInput {
  creditAccountId: string
  buyerId: string
  gatewayPaymentId: string
  amountPaise: number
}

/**
 * Applies a Khata repayment once its Payment Link is paid — routed here from
 * razorpayWebhook.ts's `payment.captured` handler when the payment's notes
 * carry `purpose: 'credit_repayment'` (design brief item 7: "repayment via a
 * payment link that credits the account"), rather than the usual order
 * lookup/applyPaymentCaptured path, since a repayment isn't tied to an order
 * at all. Idempotent by `gatewayPaymentId`, same convention as
 * checkout/paymentTransition.ts's `payments/{gatewayPaymentId}` keying.
 */
export async function applyCreditRepayment(input: CreditRepaymentInput): Promise<void> {
  const db = getFirestore()
  const repaymentRef = db.collection('creditRepayments').doc(input.gatewayPaymentId)
  const creditAccountRef = db.collection('creditAccounts').doc(input.creditAccountId)

  const applied = await db.runTransaction(async (tx) => {
    const [repaymentSnapshot, creditSnapshot, buyerSnapshot] = await Promise.all([
      tx.get(repaymentRef),
      tx.get(creditAccountRef),
      tx.get(db.collection('users').doc(input.buyerId)),
    ])
    if (repaymentSnapshot.exists) return false // Already applied — duplicate webhook delivery.
    if (!creditSnapshot.exists) {
      logger.error('applyCreditRepayment: creditAccount not found', { creditAccountId: input.creditAccountId })
      return false
    }
    const credit = creditAccountSchema.parse({ id: creditSnapshot.id, ...creditSnapshot.data() })
    const buyerLanguage = buyerSnapshot.exists && buyerSnapshot.data()?.preferredLanguage === 'hi' ? 'hi' : 'en'
    const now = Date.now()

    // A repayment never pushes availableCredit past the account's limit
    // (e.g. a stale/duplicate Payment Link paid after the limit was already
    // reduced) — cap the applied amount to what's actually outstanding.
    const appliedAmountPaise = Math.min(input.amountPaise, credit.outstandingPaise)

    tx.set(repaymentRef, {
      creditAccountId: input.creditAccountId,
      buyerId: input.buyerId,
      amountPaise: input.amountPaise,
      appliedAmountPaise,
      createdAt: now,
    })
    tx.update(creditAccountRef, {
      availableCreditPaise: FieldValue.increment(appliedAmountPaise),
      outstandingPaise: FieldValue.increment(-appliedAmountPaise),
      updatedAt: now,
    })

    queueNotification(tx, db, {
      userId: input.buyerId,
      type: 'credit_repayment_received',
      language: buyerLanguage,
    })

    return true
  })

  if (!applied) return

  // Best-effort: if this repayment fully cleared the account, flip the most
  // recent unpaid statement to 'paid' so the buyer's statement list reflects
  // it. A partial repayment leaves the statement due/overdue as-is — the
  // buyer can see the reduced outstandingPaise on the account itself.
  try {
    const [creditSnapshot, statementSnapshot] = await Promise.all([
      creditAccountRef.get(),
      db
        .collection('creditStatements')
        .where('creditAccountId', '==', input.creditAccountId)
        .where('status', 'in', ['due', 'overdue'])
        .orderBy('dueDate', 'desc')
        .limit(1)
        .get(),
    ])
    const credit = creditAccountSchema.parse({ id: creditSnapshot.id, ...creditSnapshot.data() })
    const statementDoc = statementSnapshot.docs[0]
    if (statementDoc && credit.outstandingPaise === 0) {
      await statementDoc.ref.update({ status: 'paid', paidAt: Date.now(), updatedAt: Date.now() })
    }
  } catch (error) {
    logger.warn('applyCreditRepayment: statement reconciliation failed', {
      creditAccountId: input.creditAccountId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
