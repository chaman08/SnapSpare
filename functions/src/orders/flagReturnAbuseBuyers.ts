import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getReturnsConfig } from './returnsConfig.js'

/**
 * Design brief item 8: "return-rate flag per buyer." Daily live-query sweep
 * (no buyerDailyStats rollup exists — same accepted live-query-vs-rollup
 * tradeoff computeSellerTrustScores.ts already made on the seller side, at
 * this phase's scale) over config/returns.returnRateAbuseWindowDays,
 * flagging any buyer with enough order volume
 * (returnRateAbuseMinOrders) whose return rate crosses
 * returnRateAbuseThresholdPercent. Admin-visible only (user.returnAbuseFlag/
 * returnRatePercent) — does not itself restrict anything, unlike the
 * RTO-driven codAbuseFlag auto-block in processRtoRefund.ts.
 */
export const flagReturnAbuseBuyers = onSchedule({ region: 'asia-south1', schedule: 'every 24 hours' }, async () => {
  const db = getFirestore()
  const config = await getReturnsConfig()
  const cutoff = Date.now() - config.returnRateAbuseWindowDays * 24 * 60 * 60_000

  const returnsSnapshot = await db.collection('returns').where('requestedAt', '>=', cutoff).get()
  const returnCountByBuyer = new Map<string, number>()
  for (const doc of returnsSnapshot.docs) {
    const buyerId = doc.data().buyerId as string | undefined
    if (!buyerId) continue
    returnCountByBuyer.set(buyerId, (returnCountByBuyer.get(buyerId) ?? 0) + 1)
  }

  const now = Date.now()
  await Promise.all(
    Array.from(returnCountByBuyer.entries()).map(async ([buyerId, returnsCount]) => {
      // Every subOrder that reached (or passed through) delivered in the
      // window — the denominator for "how often does this buyer return
      // what they ordered."
      const subOrdersSnapshot = await db
        .collection('subOrders')
        .where('buyerId', '==', buyerId)
        .where('createdAt', '>=', cutoff)
        .where('status', 'in', ['delivered', 'returned', 'refunded'])
        .get()
      const deliveredCount = subOrdersSnapshot.size
      if (deliveredCount < config.returnRateAbuseMinOrders) return

      const returnRatePercent = Math.round((returnsCount / deliveredCount) * 100)
      await db.collection('users').doc(buyerId).update({
        returnRatePercent,
        returnAbuseFlag: returnRatePercent >= config.returnRateAbuseThresholdPercent,
        updatedAt: now,
      })
    }),
  )
})
