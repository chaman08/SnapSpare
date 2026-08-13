import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { userIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const auditLogIdSchema = z.string().min(1)
export type AuditLogId = z.infer<typeof auditLogIdSchema>

/**
 * Append-only trail of every mutating action taken through /admin — actor,
 * action, target, before/after snapshot, timestamp, IP (Phase 19 design
 * brief). `action` and `targetType` are deliberately free strings rather
 * than a closed enum: the admin console spans a dozen modules and an
 * ever-growing enum shared across all of them would be a bigger maintenance
 * burden than a documented `domain.verb` convention (e.g. `seller.suspend`,
 * `coupon.create`, `config.update`) with `targetType` set to the Firestore
 * collection the action mutated (e.g. `sellers`, `coupons`). `before`/
 * `after` are opaque snapshots of the target document (or the relevant
 * subset of it) — `before` absent means the action created the target,
 * `after` absent means it deleted it. Written only by
 * functions/src/util/auditLog.ts's `writeAuditLog` (Admin SDK, bypasses
 * rules) — never client-writable, see firestore.rules' `auditLogs` block.
 */
export const auditLogSchema = z.object({
  id: auditLogIdSchema,
  actorId: userIdSchema,
  actorEmail: z.string().email().optional(),
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  /** Free-text reason/note the admin supplied for the action, when the module collects one (e.g. a force-cancel reason). Duplicated from the mutation's own request for a fast audit-trail read without joining back to the target doc. */
  note: z.string().optional(),
  /** Best-effort client IP — see extractIp() in functions/src/util/auditLog.ts for how it's derived from the Cloud Run proxy chain. Absent only if genuinely unavailable (never blocks the underlying action). */
  ip: z.string().optional(),
  createdAt: epochMsSchema,
})
export type AuditLog = z.infer<typeof auditLogSchema>

export const auditLogConverter = makeFirestoreConverter(auditLogSchema)

/** Query params for the admin Audit Log viewer (features/admin/api/auditLogActions.ts) — every field optional, ANDed together. */
export const auditLogQuerySchema = z.object({
  actorId: userIdSchema.optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  action: z.string().optional(),
})
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>
