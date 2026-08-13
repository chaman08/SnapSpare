import { roleSchema, sellerIdSchema, userIdSchema } from '@snapspare/shared'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { writeAuditLog } from '../util/auditLog.js'

const requestSchema = z.object({
  userId: userIdSchema,
  role: roleSchema,
  sellerId: sellerIdSchema.optional(),
})

/**
 * Admin-only callable that sets a user's role (and, for sellers, their
 * sellerId) as a custom claim, and mirrors the role into their Firestore
 * profile for display purposes. The client must call `getIdToken(true)`
 * (force refresh) after this succeeds, since claim changes only take effect
 * on the *next* ID token.
 */
export const setUserRole = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request) => {
  if (request.auth?.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can set user roles')
  }

  const parsed = requestSchema.safeParse(request.data)
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message)
  }
  const { userId, role, sellerId } = parsed.data

  if (role === 'seller' && !sellerId) {
    throw new HttpsError('invalid-argument', 'sellerId is required when role is "seller"')
  }

  await getAuth().setCustomUserClaims(userId, {
    role,
    ...(sellerId ? { sellerId } : {}),
  })

  await getFirestore()
    .collection('users')
    .doc(userId)
    .update({
      roles: FieldValue.arrayUnion(role),
      primaryRole: role,
      updatedAt: Date.now(),
    })

  await writeAuditLog({
    request,
    action: 'user.setRole',
    targetType: 'users',
    targetId: userId,
    after: { role, sellerId },
  })

  return { ok: true }
})
