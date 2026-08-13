import { z } from 'zod'
import { userIdSchema } from '../ids'

/** Users module (design brief item 11): admin toggle for the two buyer-abuse flags — both are otherwise only auto-set by processRtoRefund.ts/flagReturnAbuseBuyers.ts (see firestore.rules' unchangedProtectedUserFields), so this callable is the one sanctioned manual override path. */
export const adminSetUserFlagsRequestSchema = z.object({
  userId: userIdSchema,
  codAbuseFlag: z.boolean().optional(),
  returnAbuseFlag: z.boolean().optional(),
})
export type AdminSetUserFlagsRequest = z.infer<typeof adminSetUserFlagsRequestSchema>

export const adminSetUserFlagsResultSchema = z.object({ ok: z.literal(true) })
export type AdminSetUserFlagsResult = z.infer<typeof adminSetUserFlagsResultSchema>

/**
 * Users module impersonation (design brief item 11: "logged and
 * consent-gated"). `reason` is the admin's documented justification for the
 * session — this phase gates on the admin recording *why* (fully audited,
 * see startImpersonation.ts), not on collecting a live consent signal from
 * the user themselves (no such UI/notification flow exists yet — see the
 * module's left-out note). Every session is written to
 * `impersonationSessions` and audit-logged regardless of outcome.
 */
export const startImpersonationRequestSchema = z.object({
  userId: userIdSchema,
  reason: z.string().min(1),
})
export type StartImpersonationRequest = z.infer<typeof startImpersonationRequestSchema>

export const startImpersonationResultSchema = z.object({
  customToken: z.string(),
  sessionId: z.string(),
})
export type StartImpersonationResult = z.infer<typeof startImpersonationResultSchema>
