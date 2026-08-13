import {
  type AdminDashboardMetrics,
  adminDashboardMetricsRequestSchema,
} from '@snapspare/shared'
import { type Firestore, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'

const DAY_MS = 24 * 60 * 60_000

function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

interface OrderPeriodAggregate {
  gmvPaise: number
  orderCount: number
  buyerOrderCounts: Map<string, number>
  nonCodPaid: number
  nonCodFailed: number
}

async function aggregateOrders(db: Firestore, fromMs: number, toMs: number): Promise<OrderPeriodAggregate> {
  const snapshot = await db.collection('orders').where('placedAt', '>=', fromMs).where('placedAt', '<', toMs).get()

  let gmvPaise = 0
  let orderCount = 0
  let nonCodPaid = 0
  let nonCodFailed = 0
  const buyerOrderCounts = new Map<string, number>()

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const status = data.status as string
    if (status === 'cancelled') continue

    orderCount += 1
    gmvPaise += (data.totalPaise as number) ?? 0
    const buyerId = data.buyerId as string
    buyerOrderCounts.set(buyerId, (buyerOrderCounts.get(buyerId) ?? 0) + 1)

    if (data.paymentMethod !== 'cod') {
      if (data.paymentStatus === 'paid') nonCodPaid += 1
      else if (data.paymentStatus === 'failed') nonCodFailed += 1
    }
  }

  return { gmvPaise, orderCount, buyerOrderCounts, nonCodPaid, nonCodFailed }
}

async function aggregateTakeRate(db: Firestore, fromMs: number, toMs: number): Promise<number> {
  const snapshot = await db.collection('subOrders').where('createdAt', '>=', fromMs).where('createdAt', '<', toMs).get()
  let commissionPaise = 0
  let totalPaise = 0
  for (const doc of snapshot.docs) {
    const data = doc.data()
    if (typeof data.commissionPaise !== 'number') continue
    commissionPaise += data.commissionPaise as number
    totalPaise += (data.totalPaise as number) ?? 0
  }
  return totalPaise > 0 ? (commissionPaise / totalPaise) * 100 : 0
}

async function countNewUsers(db: Firestore, collectionName: 'users' | 'sellers', field: string, fromMs: number, toMs: number, extraWhere?: [string, FirebaseFirestore.WhereFilterOp, unknown]): Promise<number> {
  let query: FirebaseFirestore.Query = db.collection(collectionName).where(field, '>=', fromMs).where(field, '<', toMs)
  if (extraWhere) query = query.where(...extraWhere)
  const snapshot = await query.count().get()
  return snapshot.data().count
}

/**
 * Dashboard module (design brief item 1). All money figures are integer
 * paise; percentages are plain numbers (e.g. 12.5 means 12.5%). See
 * adminDashboard.ts's field comments for exactly how each metric is derived
 * — several (takeRate, repeatRate, paymentSuccessRate) are documented
 * simplifications chosen to stay a cheap on-demand query instead of a
 * precomputed rollup pipeline.
 */
export const getAdminDashboardMetrics = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<AdminDashboardMetrics> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = adminDashboardMetricsRequestSchema.safeParse(request.data ?? {})
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const { periodDays } = parsed.data

    const db = getFirestore()
    const now = Date.now()
    const currentFrom = now - periodDays * DAY_MS
    const previousFrom = currentFrom - periodDays * DAY_MS

    const [current, previous, takeRateCurrent, takeRatePrevious, newBuyersCurrent, newBuyersPrevious, newSellersCurrent, newSellersPrevious] =
      await Promise.all([
        aggregateOrders(db, currentFrom, now),
        aggregateOrders(db, previousFrom, currentFrom),
        aggregateTakeRate(db, currentFrom, now),
        aggregateTakeRate(db, previousFrom, currentFrom),
        countNewUsers(db, 'users', 'createdAt', currentFrom, now, ['primaryRole', '==', 'buyer']),
        countNewUsers(db, 'users', 'createdAt', previousFrom, currentFrom, ['primaryRole', '==', 'buyer']),
        countNewUsers(db, 'sellers', 'onboardedAt', currentFrom, now),
        countNewUsers(db, 'sellers', 'onboardedAt', previousFrom, currentFrom),
      ])

    const repeatBuyers = (agg: OrderPeriodAggregate) => {
      let repeatOrders = 0
      for (const count of agg.buyerOrderCounts.values()) {
        if (count > 1) repeatOrders += count
      }
      return agg.orderCount > 0 ? (repeatOrders / agg.orderCount) * 100 : 0
    }

    const paymentSuccessRate = (agg: OrderPeriodAggregate) => {
      const attempts = agg.nonCodPaid + agg.nonCodFailed
      return attempts > 0 ? (agg.nonCodPaid / attempts) * 100 : 0
    }

    const aovCurrent = current.orderCount > 0 ? current.gmvPaise / current.orderCount : 0
    const aovPrevious = previous.orderCount > 0 ? previous.gmvPaise / previous.orderCount : 0

    const [slaBreachesSnapshot, failedPayoutsSnapshot, stuckPaymentsSnapshot, spuriousReportsSnapshot] = await Promise.all([
      db.collection('slaBreaches').where('breachedAt', '>=', now - DAY_MS).count().get(),
      db.collection('payouts').where('status', '==', 'failed').count().get(),
      db.collection('orders').where('status', '==', 'pending_payment').where('placedAt', '<', now - 60 * 60_000).count().get(),
      db.collection('spuriousReports').where('status', '!=', 'resolved').count().get(),
    ])

    return {
      period: { fromMs: currentFrom, toMs: now, days: periodDays },
      gmvPaise: { current: current.gmvPaise, previous: previous.gmvPaise, changePercent: changePercent(current.gmvPaise, previous.gmvPaise) },
      orderCount: { current: current.orderCount, previous: previous.orderCount, changePercent: changePercent(current.orderCount, previous.orderCount) },
      aovPaise: { current: aovCurrent, previous: aovPrevious, changePercent: changePercent(aovCurrent, aovPrevious) },
      takeRatePercent: { current: takeRateCurrent, previous: takeRatePrevious, changePercent: changePercent(takeRateCurrent, takeRatePrevious) },
      newBuyers: { current: newBuyersCurrent, previous: newBuyersPrevious, changePercent: changePercent(newBuyersCurrent, newBuyersPrevious) },
      newSellers: { current: newSellersCurrent, previous: newSellersPrevious, changePercent: changePercent(newSellersCurrent, newSellersPrevious) },
      repeatRatePercent: {
        current: repeatBuyers(current),
        previous: repeatBuyers(previous),
        changePercent: changePercent(repeatBuyers(current), repeatBuyers(previous)),
      },
      paymentSuccessRatePercent: {
        current: paymentSuccessRate(current),
        previous: paymentSuccessRate(previous),
        changePercent: changePercent(paymentSuccessRate(current), paymentSuccessRate(previous)),
      },
      alerts: {
        slaBreachesOpen: slaBreachesSnapshot.data().count,
        failedPayouts: failedPayoutsSnapshot.data().count,
        stuckPayments: stuckPaymentsSnapshot.data().count,
        spuriousReportsOpen: spuriousReportsSnapshot.data().count,
      },
    }
  },
)
