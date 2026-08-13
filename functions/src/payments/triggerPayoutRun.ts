import { type TriggerPayoutRunResult } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getAppConfig } from '../checkout/appConfig.js'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { PAYOUT_RUN_BATCH_SIZE, PAYOUT_RUN_DAY_MS, processSellerPayout, startOfUtcDay } from './runSellerPayouts.js'

/**
 * Finance module's manual payout-run trigger (design brief item 8) — runs
 * the exact same eligibility query and per-seller aggregation as the
 * scheduled `runSellerPayouts`, just on demand instead of waiting for the
 * next `every 24 hours` tick. Deliberately platform-wide only (no
 * single-seller filter) so it reuses the schedule's existing composite
 * index rather than needing a new one.
 */
export const triggerPayoutRun = onCall({ enforceAppCheck: true, region: 'asia-south1', timeoutSeconds: 300 }, async (request): Promise<TriggerPayoutRunResult> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

  const db = getFirestore()
  const now = Date.now()
  const periodTo = startOfUtcDay(now)

  const appConfig = await getAppConfig()
  const eligibleCutoff = now - appConfig.defaultReturnWindowDays * PAYOUT_RUN_DAY_MS

  const snapshot = await db
    .collection('subOrders')
    .where('status', '==', 'delivered')
    .where('payoutId', '==', null)
    .where('shipment.deliveredAt', '<=', eligibleCutoff)
    .limit(PAYOUT_RUN_BATCH_SIZE)
    .get()

  const bySeller = new Map<string, string[]>()
  for (const doc of snapshot.docs) {
    const sellerId = doc.data().sellerId as string
    const ids = bySeller.get(sellerId) ?? []
    ids.push(doc.id)
    bySeller.set(sellerId, ids)
  }

  await Promise.all(
    Array.from(bySeller.entries()).map(([sellerId, subOrderIds]) =>
      processSellerPayout(db, sellerId, subOrderIds, periodTo).catch((error) => {
        logger.error('triggerPayoutRun: seller payout failed', {
          sellerId,
          error: error instanceof Error ? error.message : String(error),
        })
      }),
    ),
  )

  const payoutRunRef = db.collection('payoutRuns').doc()
  await payoutRunRef.set({
    triggeredBy: request.auth.uid,
    sellersProcessed: bySeller.size,
    periodTo,
    createdAt: now,
  })

  await writeAuditLog({
    request,
    action: 'payoutRun.trigger',
    targetType: 'payoutRuns',
    targetId: payoutRunRef.id,
    after: { sellersProcessed: bySeller.size, periodTo },
  })

  return { payoutRunId: payoutRunRef.id, sellersProcessed: bySeller.size }
})
