import {
  type GetPayoutStatementResult,
  getPayoutStatementRequestSchema,
  payoutSchema,
  subOrderSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { toCsv } from '../tax/reports/csv.js'

/**
 * Downloadable per-order money breakdown for one payout (design brief item
 * 6: "payout history with downloadable statements ... a per-order money
 * breakdown so a seller can see exactly why they received what they
 * received"). Re-derives the rows from the payout's `subOrderIds` — no
 * separate statement document is stored, same "read + reshape as CSV"
 * approach as tax/reports/exportEwayBillTasks.ts.
 */
export const getPayoutStatement = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<GetPayoutStatementResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const parsed = getPayoutStatementRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid payoutId is required')

    const admin = isAdminRequest(request)
    const callerSellerId = request.auth.token.sellerId as string | undefined

    const db = getFirestore()
    const payoutSnapshot = await db.collection('payouts').doc(parsed.data.payoutId).get()
    if (!payoutSnapshot.exists) throw new HttpsError('not-found', 'payout_not_found')
    const payout = payoutSchema.parse({ id: payoutSnapshot.id, ...payoutSnapshot.data() })
    if (!admin && payout.sellerId !== callerSellerId) throw new HttpsError('permission-denied', 'not_your_payout')

    const subOrderSnapshots = await Promise.all(
      payout.subOrderIds.map((id) => db.collection('subOrders').doc(id).get()),
    )

    const rows: Array<Array<string | number>> = []
    for (const snapshot of subOrderSnapshots) {
      if (!snapshot.exists) continue
      const subOrder = subOrderSchema.parse({ id: snapshot.id, ...snapshot.data() })
      rows.push([
        subOrder.id,
        subOrder.orderId,
        subOrder.invoiceNumber ?? '',
        (subOrder.totalPaise / 100).toFixed(2),
        (subOrder.shippingPaise / 100).toFixed(2),
        ((subOrder.commissionPaise ?? 0) / 100).toFixed(2),
        ((subOrder.tcsPaise ?? 0) / 100).toFixed(2),
        ((subOrder.tdsPaise ?? 0) / 100).toFixed(2),
        ((subOrder.netPayableToSellerPaise ?? 0) / 100).toFixed(2),
      ])
    }

    const csv = toCsv(
      [
        'SubOrder ID', 'Order ID', 'Invoice No', 'Order Total', 'Shipping Charge',
        'Commission', 'TCS', 'TDS', 'Net Payable',
      ],
      rows,
    )

    return { csv, rowCount: rows.length }
  },
)
