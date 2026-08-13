import {
  ewayBillTaskSchema,
  markEwayBillGeneratedRequestSchema,
  type MarkEwayBillGeneratedResult,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'

/**
 * Records the e-way bill number a seller (or admin) obtained by manually
 * filing the exported JSON/CSV payload on the GST portal (design brief
 * item 6 — no live NIC/GSP API is integrated in this phase, see
 * ewayBill/manualExportProvider.ts).
 */
export const markEwayBillGenerated = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<MarkEwayBillGeneratedResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const parsed = markEwayBillGeneratedRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid ewayBillTaskId and ewayBillNumber are required')

    const db = getFirestore()
    const ref = db.collection('ewayBillTasks').doc(parsed.data.ewayBillTaskId)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'eway_bill_task_not_found')
    const task = ewayBillTaskSchema.parse({ id: snapshot.id, ...snapshot.data() })

    const sellerId = request.auth.token.sellerId as string | undefined
    const admin = isAdminRequest(request)
    if (task.sellerId !== sellerId && !admin) throw new HttpsError('permission-denied', 'not_your_task')
    if (task.status === 'generated') throw new HttpsError('failed-precondition', 'already_generated')

    const now = Date.now()
    await ref.update({
      status: 'generated',
      ewayBillNumber: parsed.data.ewayBillNumber,
      ewayBillGeneratedAt: now,
      updatedAt: now,
    })
    if (admin) {
      await writeAuditLog({
        request,
        action: 'ewayBillTask.markGenerated',
        targetType: 'ewayBillTasks',
        targetId: task.id,
        after: { status: 'generated', ewayBillNumber: parsed.data.ewayBillNumber },
      })
    }

    return { ewayBillTaskId: task.id, status: 'generated' }
  },
)
