import { campaignSchema, type SaveCampaignResult, saveCampaignRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'

/** Marketing module's campaign composer (design brief item 9) — saves a draft. Only a `draft` campaign may be edited; sendCampaign.ts is the only path that ever changes `status`. */
export const saveCampaign = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SaveCampaignResult> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

  const parsed = saveCampaignRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
  const input = parsed.data

  const db = getFirestore()
  const now = Date.now()

  if (input.id) {
    const ref = db.collection('campaigns').doc(input.id)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'campaign_not_found')
    const campaign = campaignSchema.parse({ id: snapshot.id, ...snapshot.data() })
    if (campaign.status !== 'draft') throw new HttpsError('failed-precondition', 'campaign_already_sent')

    await ref.update({ title: input.title, body: input.body, audience: input.audience, updatedAt: now })
    await writeAuditLog({ request, action: 'campaign.update', targetType: 'campaigns', targetId: ref.id, after: input })
    return { id: ref.id }
  }

  const ref = db.collection('campaigns').doc()
  await ref.set({
    title: input.title,
    body: input.body,
    audience: input.audience,
    status: 'draft',
    createdBy: request.auth.uid,
    createdAt: now,
    updatedAt: now,
  })
  await writeAuditLog({ request, action: 'campaign.create', targetType: 'campaigns', targetId: ref.id, after: input })
  return { id: ref.id }
})
