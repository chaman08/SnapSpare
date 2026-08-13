import type { AuditLog } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import type { CallableRequest } from 'firebase-functions/v2/https'
import { extractIp } from './requestContext.js'
import { stripUndefined } from './stripUndefined.js'

export interface WriteAuditLogInput {
  request: CallableRequest
  /** `domain.verb` — see auditLogSchema's header comment for the convention. */
  action: string
  /** Firestore collection name the action mutated, e.g. `sellers`, `coupons`. */
  targetType: string
  targetId: string
  before?: unknown
  after?: unknown
  note?: string
}

/**
 * Every mutating admin-console callable must call this immediately after its
 * write succeeds — see any of the retrofitted admin callables (e.g.
 * functions/src/seller/reviewSellerApplication.ts) for the call-site
 * pattern. Writing the audit entry never fails the caller's action: a
 * failure here is logged and swallowed, since losing the audit trail is
 * preferable to losing the underlying business operation the admin was
 * trying to perform (and the alternative — wrapping in a transaction with
 * the primary write — would mean an audit-log outage blocks all admin
 * mutations, which is worse).
 */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  const { request, action, targetType, targetId, before, after, note } = input
  if (!request.auth) return

  try {
    const doc: Omit<AuditLog, 'id'> = {
      actorId: request.auth.uid,
      actorEmail: typeof request.auth.token.email === 'string' ? request.auth.token.email : undefined,
      action,
      targetType,
      targetId,
      before,
      after,
      note,
      ip: extractIp(request),
      createdAt: Date.now(),
    }
    await getFirestore().collection('auditLogs').add(stripUndefined(doc))
  } catch (error) {
    logger.error('writeAuditLog failed', {
      action,
      targetType,
      targetId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
