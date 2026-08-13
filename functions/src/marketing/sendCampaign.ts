import { campaignSchema, type SendCampaignResult, sendCampaignRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'

const RECIPIENT_CAP = 2000
const BATCH_SIZE = 450

/**
 * Marketing module's campaign send (design brief item 9). Audience
 * resolution is a `buyerType` query (or every buyer for 'all'), capped at
 * RECIPIENT_CAP for safety — a genuinely larger broadcast would need a
 * paginated/scheduled fan-out, out of scope here. Writes one
 * `notificationsQueue` doc per recipient directly (not via
 * queueNotification's transaction helper — there's no single transaction
 * spanning thousands of writes) so dispatchNotification.ts's existing
 * per-doc trigger fans each one out over push/in-app exactly like every
 * other notification type.
 */
export const sendCampaign = onCall(
  { enforceAppCheck: true, region: 'asia-south1', timeoutSeconds: 300 },
  async (request): Promise<SendCampaignResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = sendCampaignRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')

    const db = getFirestore()
    const ref = db.collection('campaigns').doc(parsed.data.id)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'campaign_not_found')
    const campaign = campaignSchema.parse({ id: snapshot.id, ...snapshot.data() })
    if (campaign.status !== 'draft') throw new HttpsError('failed-precondition', 'campaign_already_sent')

    let usersQuery = db.collection('users').where('primaryRole', '==', 'buyer').limit(RECIPIENT_CAP) as FirebaseFirestore.Query
    if (campaign.audience.buyerType !== 'all') {
      usersQuery = db
        .collection('users')
        .where('primaryRole', '==', 'buyer')
        .where('buyerType', '==', campaign.audience.buyerType)
        .limit(RECIPIENT_CAP)
    }
    const usersSnapshot = await usersQuery.get()

    const now = Date.now()
    const doc = {
      type: 'admin_campaign' as const,
      title: campaign.title,
      body: campaign.body,
      data: { campaignTitle: campaign.title, campaignBody: campaign.body },
      channels: ['push'] as const,
      status: 'queued' as const,
      createdAt: now,
    }

    for (let i = 0; i < usersSnapshot.docs.length; i += BATCH_SIZE) {
      const batch = db.batch()
      for (const userDoc of usersSnapshot.docs.slice(i, i + BATCH_SIZE)) {
        batch.set(db.collection('notificationsQueue').doc(), { ...doc, userId: userDoc.id })
      }
      await batch.commit()
    }

    await ref.update({ status: 'sent', recipientCount: usersSnapshot.size, sentAt: now, updatedAt: now })

    await writeAuditLog({
      request,
      action: 'campaign.send',
      targetType: 'campaigns',
      targetId: campaign.id,
      after: { recipientCount: usersSnapshot.size },
    })

    return { recipientCount: usersSnapshot.size }
  },
)
