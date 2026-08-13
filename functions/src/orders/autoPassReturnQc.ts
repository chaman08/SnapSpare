import { returnSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { executeRefund } from '../payments/refundEngine.js'
import { getReturnsConfig } from './returnsConfig.js'
import { resolveReturnQcPassInTx } from './resolveReturnQcPass.js'

const BATCH_SIZE = 50

/**
 * Design brief item 4: "Refund triggered on QC pass, or auto-approved after
 * N days if the seller doesn't act." Runs daily, finds every `approved`
 * return whose reverse pickup was booked more than
 * config/returns.qcAutoPassDays ago, and auto-passes QC as `system` — same
 * resolveReturnQcPassInTx helper submitReturnQc.ts uses for a manual pass,
 * so refund/replacement behavior is identical either way.
 */
export const autoPassReturnQc = onSchedule({ region: 'asia-south1', schedule: 'every 24 hours' }, async () => {
  const db = getFirestore()
  const returnsConfig = await getReturnsConfig()
  const cutoff = Date.now() - returnsConfig.qcAutoPassDays * 24 * 60 * 60_000

  const snapshot = await db
    .collection('returns')
    .where('status', '==', 'approved')
    .where('pickup.scheduledAt', '<=', cutoff)
    .limit(BATCH_SIZE)
    .get()

  await Promise.all(snapshot.docs.map((doc) => autoPassOne(db, doc.id)))
})

async function autoPassOne(db: ReturnType<typeof getFirestore>, returnId: string): Promise<void> {
  const result = await db.runTransaction(async (tx) => {
    const returnRef = db.collection('returns').doc(returnId)
    const returnSnapshot = await tx.get(returnRef)
    if (!returnSnapshot.exists) return undefined
    const ret = returnSchema.parse({ id: returnSnapshot.id, ...returnSnapshot.data() })
    if (ret.status !== 'approved') return undefined

    const now = Date.now()
    const qc = {
      outcome: 'pass' as const,
      photos: [],
      note: 'Auto-approved — seller did not complete QC within the configured window',
      decidedBy: 'system' as const,
      decidedAt: now,
    }
    return resolveReturnQcPassInTx(tx, db, ret, qc, { type: 'system' }, now)
  })

  if (!result) return
  if (result.resolutionPreference !== 'refund') return

  try {
    await executeRefund({
      orderId: result.orderId,
      subOrderId: result.subOrderId,
      items: [{ listingId: result.listingId, qty: result.qty }],
      returnId,
      reason: 'return',
    })
  } catch (error) {
    logger.error('autoPassReturnQc: refund failed', {
      returnId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
