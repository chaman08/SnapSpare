import {
  ewayBillTaskSchema,
  type ExportEwayBillTasksResult,
  exportEwayBillTasksRequestSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../../orders/authz.js'
import { toCsv } from './csv.js'

/**
 * Exports flagged e-way-bill tasks as CSV, in the field order the GST
 * portal's bulk-upload tool expects (design brief item 6). Admin may query
 * any seller; a seller may only export their own — the same scoping
 * `ewayBillTasks` firestore.rules already applies to a direct read, kept
 * consistent here since this callable is really just "read + reshape as
 * CSV", not a privileged operation of its own.
 */
export const exportEwayBillTasks = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<ExportEwayBillTasksResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const parsed = exportEwayBillTasksRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')

    const admin = isAdminRequest(request)
    const callerSellerId = request.auth.token.sellerId as string | undefined
    if (!admin && !callerSellerId) throw new HttpsError('permission-denied', 'seller_or_admin_only')
    const sellerId = admin ? parsed.data.sellerId : callerSellerId
    if (!admin && parsed.data.sellerId && parsed.data.sellerId !== callerSellerId) {
      throw new HttpsError('permission-denied', 'not_your_tasks')
    }

    const db = getFirestore()
    let query: FirebaseFirestore.Query = db.collection('ewayBillTasks')
    if (sellerId) query = query.where('sellerId', '==', sellerId)
    if (parsed.data.status) query = query.where('status', '==', parsed.data.status)
    const snapshot = await query.orderBy('createdAt', 'desc').limit(1000).get()

    const rows: Array<Array<string | number>> = []
    for (const doc of snapshot.docs) {
      const task = ewayBillTaskSchema.safeParse({ id: doc.id, ...doc.data() })
      if (!task.success) continue
      const { payload } = task.data
      rows.push([
        task.data.id,
        task.data.status,
        payload.docNo,
        payload.docDate,
        payload.fromGstin,
        payload.fromTrdName,
        payload.fromPincode,
        payload.fromStateCode,
        payload.toGstin ?? '',
        payload.toTrdName,
        payload.toPincode,
        payload.toStateCode,
        payload.totInvValue,
        task.data.ewayBillNumber ?? '',
      ])
    }

    const csv = toCsv(
      [
        'Task ID', 'Status', 'Invoice No', 'Invoice Date', 'Supplier GSTIN', 'Supplier Name',
        'From Pincode', 'From State', 'Recipient GSTIN', 'Recipient Name', 'To Pincode', 'To State',
        'Total Invoice Value', 'E-Way Bill No',
      ],
      rows,
    )

    return { csv, rowCount: rows.length }
  },
)
