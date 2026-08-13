import { sellerSchema, subOrderSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'

const WARNING_LEAD_MS = 2 * 60 * 60_000

/**
 * Warns a seller ahead of autoCancelUnacceptedSubOrders.ts's own 15-minute
 * sweep cancelling their unaccepted subOrder — fires once, the first run
 * where `slaAcceptByAt - now <= 2h` for a still-`pending` subOrder,
 * `slaWarningSentAt` gating the repeat exactly like
 * creditDueReminders.ts's beforeReminderSentAt. Reuses the same
 * `status == 'pending'` + `slaAcceptByAt <=` query shape as
 * autoCancelUnacceptedSubOrders.ts so no new composite index is needed.
 */
export const sendSlaBreachWarnings = onSchedule({ region: 'asia-south1', schedule: 'every 30 minutes' }, async () => {
  const db = getFirestore()
  const now = Date.now()

  const snapshot = await db
    .collection('subOrders')
    .where('status', '==', 'pending')
    .where('slaAcceptByAt', '<=', now + WARNING_LEAD_MS)
    .limit(100)
    .get()

  await Promise.all(
    snapshot.docs.map(async (doc) => {
      const subOrder = subOrderSchema.safeParse({ id: doc.id, ...doc.data() })
      if (!subOrder.success || subOrder.data.slaWarningSentAt || !subOrder.data.slaAcceptByAt) return

      const sellerSnapshot = await db.collection('sellers').doc(subOrder.data.sellerId).get()
      if (!sellerSnapshot.exists) return
      const seller = sellerSchema.safeParse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })
      if (!seller.success) return

      await doc.ref.update({ slaWarningSentAt: now })
      const hoursLeft = Math.max(0, Math.round((subOrder.data.slaAcceptByAt - now) / (60 * 60_000)))
      await queueNotificationDirect(db, {
        userId: seller.data.ownerUserId,
        type: 'sla_breach_warning',
        language: await resolveUserLanguage(db, seller.data.ownerUserId),
        orderId: subOrder.data.orderId,
        subOrderId: subOrder.data.id,
        data: { hoursLeft: String(hoursLeft) },
      })
    }),
  )
})
