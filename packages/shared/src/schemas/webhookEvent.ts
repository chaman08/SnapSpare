import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { webhookEventIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const webhookEventGatewaySchema = z.enum(['razorpay'])
export type WebhookEventGateway = z.infer<typeof webhookEventGatewaySchema>

export const webhookEventStatusSchema = z.enum(['received', 'processed', 'failed'])
export type WebhookEventStatus = z.infer<typeof webhookEventStatusSchema>

/**
 * One document per inbound gateway webhook delivery, written *before* any
 * processing happens (design brief: "every event written to a raw
 * webhookEvents collection before processing so nothing is ever lost"). The
 * doc id doubles as the idempotency key — see
 * functions/src/checkout/razorpayWebhook.ts's `deriveWebhookEventKey`, which
 * prefers the `x-razorpay-event-id` header (present on newer Razorpay webhook
 * deliveries) and falls back to a deterministic hash of
 * `event + entity.id + created_at` when that header is absent, so a retried
 * delivery of the same event always maps to the same doc regardless of which
 * derivation path was available. Claimed with a transactional `create` (fails
 * if the doc already exists), which is what makes re-processing a no-op.
 * Never client-readable or writable — internal bookkeeping only, same
 * treatment as `idempotencyKeys`.
 */
export const webhookEventSchema = z.object({
  id: webhookEventIdSchema,
  gateway: webhookEventGatewaySchema,
  eventType: z.string().min(1),
  /** Raw parsed JSON body of the webhook delivery, kept as-received for audit/replay. */
  payload: z.record(z.string(), z.unknown()),
  signatureValid: z.boolean(),
  status: webhookEventStatusSchema,
  receivedAt: epochMsSchema,
  processedAt: epochMsSchema.optional(),
  error: z.string().optional(),
})
export type WebhookEvent = z.infer<typeof webhookEventSchema>

export const webhookEventConverter = makeFirestoreConverter(webhookEventSchema)
