import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import {
  disputeIdSchema,
  listingIdSchema,
  notificationIdSchema,
  orderIdSchema,
  partIdSchema,
  returnIdSchema,
  reviewIdSchema,
  rfqIdSchema,
  subOrderIdSchema,
  userIdSchema,
  warrantyClaimIdSchema,
} from '../ids'
import { epochMsSchema } from './common'

/**
 * One entry per order-lifecycle event that should reach a user. Phase 9 only
 * ever writes these (typed, queued) — Phase 16 is what actually dispatches
 * them over FCM/WhatsApp/SMS and flips `status`/`sentAt`. Never client-writable
 * (see firestore.rules); a user may only ever read their own.
 */
export const notificationTypeSchema = z.enum([
  'suborder_accepted',
  'suborder_rejected',
  'suborder_packed',
  'suborder_shipped',
  'suborder_out_for_delivery',
  'suborder_delivered',
  'suborder_cancelled',
  'suborder_sla_breached',
  'order_cancelled',
  'return_requested',
  'return_approved',
  'return_rejected',
  'return_refunded',
  'suborder_ndr_raised',
  'suborder_ndr_reattempt_requested',
  'suborder_rto_initiated',
  'suborder_rto_refunded',
  'refund_failed',
  'payout_paid',
  'payout_failed',
  'credit_limit_requested',
  'credit_limit_approved',
  'credit_limit_rejected',
  'credit_statement_ready',
  'credit_due_reminder',
  'credit_overdue',
  'credit_blocked',
  'credit_repayment_received',
  'seller_application_submitted',
  'seller_application_under_review',
  'seller_application_changes_requested',
  'seller_application_approved',
  'seller_application_rejected',
  'seller_staff_invited',
  'part_request_submitted',
  'part_request_approved',
  'part_request_rejected',
  'part_request_changes_requested',
  'listing_low_stock',
  'rfq_new_match',
  'rfq_quote_received',
  'rfq_quote_accepted',
  'rfq_quote_rejected',
  'rfq_quote_withdrawn',
  'rfq_withdrawn_by_buyer',
  'rfq_expired',
  'rfq_message_received',
  // Phase 16 additions — see functions/src/notifications/templates for copy.
  'order_placed',
  'payment_confirmed',
  'payment_failed',
  'refund_initiated',
  'sla_breach_warning',
  'price_drop',
  'back_in_stock',
  'abandoned_cart',
  'kyc_status_change',
  'new_order_for_seller',
  // Phase 17 additions — see functions/src/notifications/templates for copy.
  'review_request',
  'review_seller_reply',
  'qa_question_answered',
  'spurious_report_response_requested',
  'spurious_report_resolved',
  'brand_authorization_reviewed',
  // Phase 18 additions — see functions/src/notifications/templates for copy.
  'return_picked_up_qc_pending',
  'return_qc_disputed',
  'return_replaced',
  'warranty_claim_submitted',
  'warranty_claim_decided',
  'warranty_claim_escalated',
  'dispute_opened',
  'dispute_evidence_added',
  'dispute_resolved',
  'dispute_sla_breach_warning',
  // Phase 19 addition — Marketing module's push/WhatsApp campaign composer.
  // Free-text (title/body come from the campaign itself, via
  // CopyInput.campaignTitle/campaignBody — see orders/notify.ts), unlike
  // every other type here which has fixed catalog copy.
  'admin_campaign',
  // Phase 24 additions — see functions/src/notifications/templates for copy.
  'support_ticket_replied',
  'support_ticket_resolved',
  'support_ticket_sla_breach_warning',
])
export type NotificationType = z.infer<typeof notificationTypeSchema>

export const notificationChannelSchema = z.enum(['push', 'sms', 'whatsapp', 'email'])
export type NotificationChannel = z.infer<typeof notificationChannelSchema>

/**
 * `queued` -> a dispatcher (Phase 16) hasn't picked this up yet.
 * `processing` -> a dispatch attempt is in flight.
 * `sent` -> dispatch attempted and at least one eligible channel succeeded
 *   (or no channels were eligible at all — the row is in-app-only).
 * `failed` -> attempted, no channel has succeeded yet, but at least one
 *   channel still has retries left (see `nextRetryAt`).
 * `dead_letter` -> every eligible channel exhausted its retries; see
 *   `notificationsDeadLetter` for the corresponding admin-visible record.
 */
export const notificationStatusSchema = z.enum(['queued', 'processing', 'sent', 'failed', 'dead_letter'])
export type NotificationStatus = z.infer<typeof notificationStatusSchema>

export const notificationDeliveryStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'failed',
  'dead_letter',
  'skipped',
])
export type NotificationDeliveryStatus = z.infer<typeof notificationDeliveryStatusSchema>

/** Per-channel delivery/retry bookkeeping, keyed by NotificationChannel on `notificationSchema.deliveries`. */
export const notificationDeliverySchema = z.object({
  status: notificationDeliveryStatusSchema,
  attempts: z.number().int().nonnegative().default(0),
  lastAttemptAt: epochMsSchema.optional(),
  /** Set while `status` is `pending` after a failed attempt with retries left; cleared once sent, dead-lettered, or skipped. */
  nextRetryAt: epochMsSchema.optional(),
  lastError: z.string().optional(),
  providerMessageId: z.string().optional(),
  /** Set only when status is `skipped` (preference opt-out, quiet hours, or rate limit) — never a failure. */
  skippedReason: z.string().optional(),
})
export type NotificationDelivery = z.infer<typeof notificationDeliverySchema>

export const notificationSchema = z.object({
  id: notificationIdSchema,
  userId: userIdSchema,
  type: notificationTypeSchema,
  orderId: orderIdSchema.optional(),
  subOrderId: subOrderIdSchema.optional(),
  returnId: returnIdSchema.optional(),
  warrantyClaimId: warrantyClaimIdSchema.optional(),
  disputeId: disputeIdSchema.optional(),
  rfqId: rfqIdSchema.optional(),
  listingId: listingIdSchema.optional(),
  reviewId: reviewIdSchema.optional(),
  partId: partIdSchema.optional(),
  /** Short, already-i18n-resolved copy — resolved server-side at enqueue time from the actor's `preferredLanguage` (see schemas/user.ts) so Phase 16's dispatchers don't need to know about i18next at all. */
  title: z.string().min(1),
  body: z.string().min(1),
  /** Language the title/body were resolved in — also what Phase 16's channel templates render in for this row, so a dispatcher never has to re-resolve it. */
  language: z.enum(['en', 'hi']).default('en'),
  /** Arbitrary string key/value payload (e.g. `{ awb: '...' }`) a future push-notification deep link can read without re-fetching the order, and what Phase 16's channel templates interpolate into WhatsApp/SMS/email/push copy. */
  data: z.record(z.string(), z.string()).default({}),
  /** Channels this event is eligible for; Phase 16 decides which actually fire per the user's notification preferences. Empty is valid — a queued row that's for in-app/notification-center display only. */
  channels: z.array(notificationChannelSchema).default([]),
  status: notificationStatusSchema.default('queued'),
  /** Per-channel delivery/retry state, keyed by channel; only populated for channels in `channels`. */
  deliveries: z.record(notificationChannelSchema, notificationDeliverySchema).default({}),
  /** Rollup of the earliest pending per-channel `nextRetryAt` — Firestore can't range-query into a map's dynamic keys, so this top-level field is what the retry sweep actually queries on. Cleared when no channel is pending retry. */
  nextRetryAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  sentAt: epochMsSchema.optional(),
  /** In-app read state — the in-app notification centre reads this collection directly rather than a separate feed. */
  read: z.boolean().default(false),
  readAt: epochMsSchema.optional(),
})
export type Notification = z.infer<typeof notificationSchema>

export const notificationConverter = makeFirestoreConverter(notificationSchema)
