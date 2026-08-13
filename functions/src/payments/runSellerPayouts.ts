import { payoutSchema, sellerSchema, subOrderSchema } from '@snapspare/shared'
import type { DocumentReference, Firestore } from 'firebase-admin/firestore'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getAppConfig } from '../checkout/appConfig.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { postLedgerEntries, readLedger } from '../tax/ledger.js'
import { payoutProvider } from './provider.js'

export const PAYOUT_RUN_DAY_MS = 24 * 60 * 60_000
export const PAYOUT_RUN_BATCH_SIZE = 200
const DAY_MS = PAYOUT_RUN_DAY_MS
const BATCH_SIZE = PAYOUT_RUN_BATCH_SIZE

/** Truncates to the start of the UTC day — used as the deterministic `periodTo` for this run's payout doc ids, so a retried/duplicate invocation of the same scheduled run always lands on the same `payouts/{sellerId}_{periodTo}` doc instead of creating a second one. Exported so triggerPayoutRun.ts (Finance module's manual trigger) computes the identical id. */
export function startOfUtcDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS
}

/**
 * Scheduled settlement run (design brief item 5) — daily, but each seller is
 * only actually paid out once every `config/commission.settlementCycleDays`
 * (checked against their most recent payout's `createdAt`), so "daily" is
 * just the polling cadence, not the payout frequency. For each seller with
 * eligible subOrders — `delivered`, not yet in a payout (`payoutId` unset),
 * and past the return window (so a return can no longer claw the sale back)
 * — aggregates the already-denormalized `netPayableToSellerPaise` etc. from
 * applyCommissionOnDelivered.ts, creates a `payouts/{sellerId}_{periodTo}`
 * doc (deterministic id — re-running this schedule for the same day is a
 * no-op past the aggregation step), then calls the payout provider.
 *
 * Idempotent and re-runnable: a payout doc that already reached `paid` is
 * skipped entirely; one still `processing`/`failed` retries only the gateway
 * call (never re-aggregates, since its `subOrderIds` and amounts are already
 * fixed).
 */
export const runSellerPayouts = onSchedule({ region: 'asia-south1', schedule: 'every 24 hours' }, async () => {
  const db = getFirestore()
  const now = Date.now()
  const periodTo = startOfUtcDay(now)

  const appConfig = await getAppConfig()
  const eligibleCutoff = now - appConfig.defaultReturnWindowDays * DAY_MS

  const snapshot = await db
    .collection('subOrders')
    .where('status', '==', 'delivered')
    .where('payoutId', '==', null)
    .where('shipment.deliveredAt', '<=', eligibleCutoff)
    .limit(BATCH_SIZE)
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
        logger.error('runSellerPayouts: seller payout failed', {
          sellerId,
          error: error instanceof Error ? error.message : String(error),
        })
      }),
    ),
  )
})

/** Exported for triggerPayoutRun.ts (Finance module's manual payout trigger) — same per-seller aggregation the schedule uses, so a manual run is byte-for-byte the same logic, just invoked on demand. */
export async function processSellerPayout(db: Firestore, sellerId: string, subOrderIds: string[], periodTo: number): Promise<void> {
  const payoutRef = db.collection('payouts').doc(`${sellerId}_${periodTo}`)
  const existing = await payoutRef.get()

  // Phase 17 penalty ladder: a seller under payoutHold (resolveSpuriousReport.ts)
  // is skipped entirely — no payout doc is created, so their eligible
  // subOrders stay unclaimed (payoutId unset) and roll into the next run
  // once the hold is lifted, same as any other not-yet-eligible subOrder.
  if (!existing.exists) {
    const sellerSnapshot = await db.collection('sellers').doc(sellerId).get()
    if (sellerSnapshot.exists && sellerSnapshot.data()?.payoutHold === true) return
  }

  if (existing.exists) {
    const payout = payoutSchema.parse({ id: existing.id, ...existing.data() })
    if (payout.status === 'paid') return // Already settled — nothing to do.
    // 'processing' (a previous run crashed after creating the doc but before
    // the gateway call resolved) or 'failed' (gateway declined last time) —
    // retry the gateway call only, never re-aggregate: the doc's amounts and
    // subOrderIds are already fixed.
    await attemptGatewayPayout(db, payoutRef, sellerId, payout.netAmountPaise)
    return
  }

  const now = Date.now()
  const created = await db.runTransaction(async (tx) => {
    const subOrderRefs = subOrderIds.map((id) => db.collection('subOrders').doc(id))
    const subOrderSnapshots = await Promise.all(subOrderRefs.map((ref) => tx.get(ref)))

    let grossAmountPaise = 0
    let commissionPaise = 0
    let tcsPaise = 0
    let tdsPaise = 0
    let netAmountPaise = 0
    const includedIds: string[] = []

    for (const snapshot of subOrderSnapshots) {
      if (!snapshot.exists) continue
      const subOrder = subOrderSchema.parse({ id: snapshot.id, ...snapshot.data() })
      // Re-check eligibility against the freshest read — a subOrder already
      // claimed by a payout created between the outer query and this
      // transaction is skipped rather than double-counted.
      if (subOrder.status !== 'delivered' || subOrder.payoutId || subOrder.netPayableToSellerPaise === undefined) continue

      grossAmountPaise += subOrder.totalPaise
      commissionPaise += subOrder.commissionPaise ?? 0
      tcsPaise += subOrder.tcsPaise ?? 0
      tdsPaise += subOrder.tdsPaise ?? 0
      netAmountPaise += subOrder.netPayableToSellerPaise
      includedIds.push(subOrder.id)
    }

    if (includedIds.length === 0) return undefined

    for (const id of includedIds) {
      tx.update(db.collection('subOrders').doc(id), { payoutId: payoutRef.id, updatedAt: now })
    }

    tx.set(payoutRef, {
      sellerId,
      periodFrom: now - DAY_MS,
      periodTo,
      grossAmountPaise,
      commissionPaise,
      tcsPaise,
      tdsPaise,
      adjustmentsPaise: 0,
      netAmountPaise: Math.max(0, netAmountPaise),
      status: 'processing',
      subOrderIds: includedIds,
      createdAt: now,
      updatedAt: now,
    })

    return { netAmountPaise: Math.max(0, netAmountPaise) }
  })

  if (!created) return
  await attemptGatewayPayout(db, payoutRef, sellerId, created.netAmountPaise)
}

async function attemptGatewayPayout(db: Firestore, payoutRef: DocumentReference, sellerId: string, netAmountPaise: number): Promise<void> {
  const now = Date.now()
  const sellerSnapshot = await db.collection('sellers').doc(sellerId).get()
  if (!sellerSnapshot.exists) {
    await payoutRef.update({ status: 'failed', failureReason: 'seller_not_found', updatedAt: now })
    return
  }
  const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })

  if (netAmountPaise <= 0) {
    // Nothing owed this cycle (commission/withholdings ate the full gross,
    // or a prior partial refund already zeroed it out) — mark paid with no
    // gateway call rather than attempting a zero-value bank transfer.
    await payoutRef.update({ status: 'paid', utrNumber: 'NIL', paidAt: now, updatedAt: now })
    return
  }

  try {
    const result = await payoutProvider.payToBank({
      accountHolderName: seller.bankAccount.accountHolderName,
      accountNumber: seller.bankAccount.accountNumber,
      ifsc: seller.bankAccount.ifsc,
      amountPaise: netAmountPaise,
      reference: payoutRef.id,
    })
    if (result.status !== 'processed') throw new Error(result.failureReason ?? 'payout_provider_failed')

    await payoutRef.update({ status: 'paid', utrNumber: result.utr, paidAt: now, updatedAt: now })
    await db.runTransaction(async (tx) => {
      const ledgerRead = await readLedger(tx, db, sellerId)
      postLedgerEntries(
        tx,
        db,
        ledgerRead,
        sellerId,
        [
          {
            type: 'payout_debit',
            direction: 'debit',
            amountPaise: netAmountPaise,
            referenceType: 'payout',
            referenceId: payoutRef.id,
            description: `Payout ${payoutRef.id} paid (UTR ${result.utr})`,
          },
        ],
        now,
      )
    })
    await queueNotificationDirect(db, { userId: seller.ownerUserId, type: 'payout_paid', language: 'en' })
  } catch (error) {
    logger.error('runSellerPayouts: gateway payout failed', {
      sellerId,
      payoutId: payoutRef.id,
      error: error instanceof Error ? error.message : String(error),
    })
    await payoutRef.update({
      status: 'failed',
      failureReason: error instanceof Error ? error.message : String(error),
      updatedAt: now,
    })
    await queueNotificationDirect(db, { userId: seller.ownerUserId, type: 'payout_failed', language: 'en' })
  }
}
