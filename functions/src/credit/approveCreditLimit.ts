import {
  type ApproveCreditLimitResult,
  approveCreditLimitRequestSchema,
  creditAccountSchema,
  userSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { writeAuditLog } from '../util/auditLog.js'

/**
 * Admin-only resolution of a Khata credit-limit request (or a direct
 * out-of-band grant/change — `creditLimitRequestId` is optional) — design
 * brief item 7: "a clear admin approval flow for granting limits, and log
 * every limit change." Creates the buyer's `creditAccounts` doc on first
 * approval, or adjusts an existing one's limit; either way writes a
 * `limitChanges` entry so every change to a buyer's credit line has a
 * durable, append-only audit trail.
 */
export const approveCreditLimit = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<ApproveCreditLimitResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
    const adminUid = request.auth.uid

    const parsed = approveCreditLimitRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const input = parsed.data

    const db = getFirestore()
    const buyerSnapshot = await db.collection('users').doc(input.buyerId).get()
    if (!buyerSnapshot.exists) throw new HttpsError('not-found', 'buyer_not_found')
    const buyer = userSchema.parse({ id: buyerSnapshot.id, ...buyerSnapshot.data() })
    const buyerLanguage = buyer.preferredLanguage === 'hi' ? 'hi' : 'en'
    const now = Date.now()

    if (input.creditLimitRequestId) {
      await db
        .collection('creditLimitRequests')
        .doc(input.creditLimitRequestId)
        .update({
          status: input.approved ? 'approved' : 'rejected',
          reviewedBy: adminUid,
          reviewedAt: now,
          reviewNotes: input.reviewNotes,
          updatedAt: now,
        })
    }

    if (!input.approved) {
      await queueNotificationDirect(db, { userId: input.buyerId, type: 'credit_limit_rejected', language: buyerLanguage })
      await writeAuditLog({
        request,
        action: 'creditLimit.reject',
        targetType: 'creditLimitRequests',
        targetId: input.creditLimitRequestId ?? input.buyerId,
        note: input.reviewNotes,
      })
      return {}
    }

    if (input.newLimitPaise === undefined) throw new HttpsError('invalid-argument', 'newLimitPaise is required to approve')

    if (buyer.buyerType !== 'garage' || !buyer.garageVerifiedAt) {
      throw new HttpsError('failed-precondition', 'garage_not_verified')
    }

    const existingSnapshot = await db.collection('creditAccounts').where('buyerId', '==', input.buyerId).limit(1).get()
    const existingDoc = existingSnapshot.docs[0]
    const previousLimitPaise = existingDoc ? creditAccountSchema.parse({ id: existingDoc.id, ...existingDoc.data() }).creditLimitPaise : 0

    const creditAccountRef = existingDoc?.ref ?? db.collection('creditAccounts').doc()
    if (existingDoc) {
      const existing = creditAccountSchema.parse({ id: existingDoc.id, ...existingDoc.data() })
      // Available credit is recomputed from the new limit minus what's
      // already outstanding, never incremented — a limit *decrease* below
      // the current outstanding balance floors available credit at 0
      // rather than going negative.
      const availableCreditPaise = Math.max(0, input.newLimitPaise - existing.outstandingPaise)
      await creditAccountRef.update({
        creditLimitPaise: input.newLimitPaise,
        availableCreditPaise,
        approvedBy: adminUid,
        approvedAt: now,
        updatedAt: now,
      })
    } else {
      await creditAccountRef.set({
        buyerId: input.buyerId,
        creditLimitPaise: input.newLimitPaise,
        availableCreditPaise: input.newLimitPaise,
        outstandingPaise: 0,
        status: 'active',
        approvedBy: adminUid,
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    }

    await creditAccountRef.collection('limitChanges').doc().set({
      creditAccountId: creditAccountRef.id,
      changedBy: adminUid,
      previousLimitPaise,
      newLimitPaise: input.newLimitPaise,
      reason: input.reviewNotes,
      createdAt: now,
    })

    await queueNotificationDirect(db, { userId: input.buyerId, type: 'credit_limit_approved', language: buyerLanguage })
    await writeAuditLog({
      request,
      action: 'creditLimit.approve',
      targetType: 'creditAccounts',
      targetId: creditAccountRef.id,
      before: { creditLimitPaise: previousLimitPaise },
      after: { creditLimitPaise: input.newLimitPaise },
      note: input.reviewNotes,
    })

    return { creditAccountId: creditAccountRef.id }
  },
)
