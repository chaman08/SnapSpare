import { z } from 'zod'
import { returnReasonSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import {
  creditNoteIdSchema,
  listingIdSchema,
  orderIdSchema,
  returnIdSchema,
  sellerIdSchema,
  subOrderIdSchema,
  userIdSchema,
} from '../ids'
import { epochMsSchema } from './common'
import { timelineEntrySchema } from './orderTimeline'

export const returnStatusSchema = z.enum([
  'requested',
  'approved',
  'rejected',
  /** Reserved — reverse-pickup tracking doesn't currently drive an automatic transition into this status (see decideReturn.ts's header comment); kept in the enum for forward compatibility with a future courier-webhook-driven pickup confirmation. */
  'picked_up',
  /** Seller (or the system, via autoPassReturnQc.ts) inspected the returned item and it matches the claim — triggers resolveReturnQcPass.ts. */
  'qc_passed',
  /** Seller inspected the returned item and disagrees with the claim (e.g. no damage found, wrong item sent back) — buyer or seller can escalate via disputes/openDispute.ts. */
  'qc_disputed',
  'refunded',
  /** Terminal — resolutionPreference was 'replacement' and resolveReturnQcPass.ts created the linked zero-value replacement sub-order (see replacementSubOrderId). */
  'replaced',
  'closed',
])
export type ReturnStatus = z.infer<typeof returnStatusSchema>

export const returnResolutionPreferenceSchema = z.enum(['refund', 'replacement'])
export type ReturnResolutionPreference = z.infer<typeof returnResolutionPreferenceSchema>

export const returnPickupInfoSchema = z.object({
  providerShipmentId: z.string().min(1),
  providerOrderId: z.string().min(1).optional(),
  awb: z.string().min(1).optional(),
  courier: z.string().min(1).optional(),
  scheduledAt: epochMsSchema,
})
export type ReturnPickupInfo = z.infer<typeof returnPickupInfoSchema>

export const returnQcOutcomeSchema = z.enum(['pass', 'dispute'])
export type ReturnQcOutcome = z.infer<typeof returnQcOutcomeSchema>

export const returnQcSchema = z.object({
  outcome: returnQcOutcomeSchema,
  photos: z.array(z.string().min(1)).default([]),
  note: z.string().max(1000).optional(),
  /** 'system' when autoPassReturnQc.ts auto-passed QC after the seller missed the window — otherwise the deciding seller/admin's userId. */
  decidedBy: z.union([userIdSchema, z.literal('system')]),
  decidedAt: epochMsSchema,
})
export type ReturnQc = z.infer<typeof returnQcSchema>

export const returnSchema = z.object({
  id: returnIdSchema,
  orderId: orderIdSchema,
  subOrderId: subOrderIdSchema,
  buyerId: userIdSchema,
  sellerId: sellerIdSchema,
  listingId: listingIdSchema,
  qty: z.number().int().positive(),
  reason: returnReasonSchema,
  reasonNotes: z.string().optional(),
  /** Buyer's requested outcome at request time — consulted by resolveReturnQcPass.ts once QC passes. */
  resolutionPreference: returnResolutionPreferenceSchema,
  status: returnStatusSchema,
  refundAmountPaise: z.number().int().nonnegative().optional(),
  /** Set once functions/src/tax/generateCreditNoteOnReturnRefunded.ts issues a GST credit note against the original invoice — see schemas/invoice.ts's creditNoteSchema. Absent for a subOrder that was never invoiced (returned before it shipped is not possible today; kept optional for safety). */
  creditNoteId: creditNoteIdSchema.optional(),
  /** Storage paths (not public URLs) — private, same as spuriousReport/warrantyClaim evidence. Cross-party read (seller viewing buyer's evidence) goes through getReturnEvidenceUrls.ts's signed-URL callable, never a direct Storage read. */
  images: z.array(z.string().min(1)).default([]),
  /** Optional evidence video — Storage path, same access pattern as images. */
  videoPath: z.string().min(1).optional(),
  /** Set by decideReturn.ts from config/returns.buyerFaultReasons — false/absent means the seller bears return shipping. */
  sellerFault: z.boolean().optional(),
  /** Deducted from refundAmountPaise when sellerFault is false — config/returns.buyerFaultShippingFeePaise at decision time. */
  returnShippingDeductionPaise: z.number().int().nonnegative().optional(),
  /** Set by decideReturn.ts after provider.createReversePickup() succeeds. */
  pickup: returnPickupInfoSchema.optional(),
  /** Set by submitReturnQc.ts (manual) or autoPassReturnQc.ts (auto-pass after config/returns.qcAutoPassDays). */
  qc: returnQcSchema.optional(),
  /** Set by resolveReturnQcPass.ts when resolutionPreference is 'replacement' and QC passed. */
  replacementSubOrderId: subOrderIdSchema.optional(),
  /** Append-only status-change audit trail, same shape/convention as subOrder.timeline. */
  timeline: z.array(timelineEntrySchema).default([]),
  requestedAt: epochMsSchema,
  resolvedAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Return = z.infer<typeof returnSchema>

export const returnConverter = makeFirestoreConverter(returnSchema)
