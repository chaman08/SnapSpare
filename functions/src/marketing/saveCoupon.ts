import { type SaveCouponResult, saveCouponRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'

/** Marketing module's coupon builder (design brief item 9). `id` absent means create; setting `status: 'inactive'` is how a coupon is retired (see saveCouponRequestSchema's header comment on why there's no hard delete). */
export const saveCoupon = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SaveCouponResult> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

  const parsed = saveCouponRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
  const input = parsed.data

  const db = getFirestore()
  const now = Date.now()
  const isCreate = !input.id
  const ref = input.id ? db.collection('coupons').doc(input.id) : db.collection('coupons').doc()

  const base = stripUndefined({
    code: input.code,
    description: input.description,
    minOrderValuePaise: input.minOrderValuePaise,
    applicableCategorySlugs: input.applicableCategorySlugs,
    applicableSellerIds: input.applicableSellerIds,
    usageLimitTotal: input.usageLimitTotal,
    usageLimitPerUser: input.usageLimitPerUser,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    status: input.status,
    discountType: input.discountType,
    ...(input.discountType === 'percent'
      ? { discountPercent: input.discountPercent, maxDiscountPaise: input.maxDiscountPaise }
      : { discountAmountPaise: input.discountAmountPaise }),
    updatedAt: now,
    ...(isCreate ? { usedCount: 0, createdAt: now } : {}),
  })
  await ref.set(base, { merge: true })

  await writeAuditLog({
    request,
    action: isCreate ? 'coupon.create' : 'coupon.update',
    targetType: 'coupons',
    targetId: ref.id,
    after: input,
  })

  return { id: ref.id }
})
