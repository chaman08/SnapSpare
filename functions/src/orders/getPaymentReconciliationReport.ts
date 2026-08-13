import {
  type GetPaymentReconciliationReportResult,
  getPaymentReconciliationReportRequestSchema,
  type PaymentReconciliationRow,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from './authz.js'

const DAY_MS = 24 * 60 * 60_000
const STALE_PENDING_MS = 60 * 60_000

/**
 * Orders module payment reconciliation view (design brief item 6): a cheap
 * on-demand scan (not a precomputed rollup) surfacing orders whose payment
 * state looks wrong — a `pending_payment` order past the point
 * releaseExpiredReservations.ts should have swept it, a gateway payment
 * that came back `failed`, or a `paid` order still holding a stock
 * reservation. `paid_but_uncancelled_reservation` in particular flags a
 * possible releaseExpiredReservations.ts miss worth investigating.
 */
export const getPaymentReconciliationReport = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<GetPaymentReconciliationReportResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = getPaymentReconciliationReportRequestSchema.safeParse(request.data ?? {})
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const { lookbackDays } = parsed.data

    const db = getFirestore()
    const since = Date.now() - lookbackDays * DAY_MS
    const snapshot = await db.collection('orders').where('placedAt', '>=', since).get()

    const rows: PaymentReconciliationRow[] = []
    const now = Date.now()

    for (const doc of snapshot.docs) {
      const data = doc.data()
      const status = data.status as string
      const paymentStatus = data.paymentStatus as string
      const paymentMethod = data.paymentMethod as string
      const placedAt = data.placedAt as number

      let issue: PaymentReconciliationRow['issue'] | undefined
      if (status === 'pending_payment' && placedAt < now - STALE_PENDING_MS) {
        issue = 'pending_payment_stale'
      } else if (paymentStatus === 'failed' && status !== 'cancelled') {
        issue = 'failed_payment'
      } else if (paymentStatus === 'paid' && status === 'pending_payment') {
        issue = 'paid_but_uncancelled_reservation'
      }

      if (!issue) continue
      rows.push({
        orderId: doc.id,
        placedAt,
        paymentMethod,
        paymentStatus,
        orderStatus: status,
        totalPaise: (data.totalPaise as number) ?? 0,
        issue,
      })
    }

    rows.sort((a, b) => b.placedAt - a.placedAt)
    return { rows }
  },
)
