import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import {
  disputeIdSchema,
  orderIdSchema,
  returnIdSchema,
  sellerIdSchema,
  subOrderIdSchema,
  userIdSchema,
  warrantyClaimIdSchema,
} from '../ids'
import { epochMsSchema } from './common'

export const disputeTypeSchema = z.enum(['return_qc', 'warranty_claim', 'other'])
export type DisputeType = z.infer<typeof disputeTypeSchema>

export const disputeStatusSchema = z.enum(['open', 'under_review', 'resolved'])
export type DisputeStatus = z.infer<typeof disputeStatusSchema>

export const disputeResolutionActionSchema = z.enum([
  'refund_buyer',
  'partial_refund',
  'uphold_seller',
  'dismissed',
])
export type DisputeResolutionAction = z.infer<typeof disputeResolutionActionSchema>

export const disputeEvidenceEntrySchema = z.object({
  url: z.string().min(1),
  uploadedBy: userIdSchema,
  uploadedAt: epochMsSchema,
  note: z.string().max(500).optional(),
})
export type DisputeEvidenceEntry = z.infer<typeof disputeEvidenceEntrySchema>

export const disputeResolutionSchema = z.object({
  action: disputeResolutionActionSchema,
  refundAmountPaise: z.number().int().nonnegative().optional(),
  /** Mandatory — an admin can never force a resolution without leaving a reason on the record. */
  adminNote: z.string().min(1).max(2000),
  resolvedBy: userIdSchema,
  resolvedAt: epochMsSchema,
})
export type DisputeResolution = z.infer<typeof disputeResolutionSchema>

export const disputeSchema = z.object({
  id: disputeIdSchema,
  type: disputeTypeSchema,
  returnId: returnIdSchema.optional(),
  warrantyClaimId: warrantyClaimIdSchema.optional(),
  orderId: orderIdSchema,
  subOrderId: subOrderIdSchema,
  buyerId: userIdSchema,
  sellerId: sellerIdSchema,
  openedBy: z.enum(['buyer', 'seller']),
  reasonNotes: z.string().min(1).max(2000),
  /** Full evidence timeline (requirement 7) — seeded from the linked return/claim's images at open time, then buyer/seller/admin can each append via addDisputeEvidence.ts. */
  evidence: z.array(disputeEvidenceEntrySchema).default([]),
  status: disputeStatusSchema,
  /** now + config/returns.disputeSlaHours at open time — sendDisputeSlaBreachWarnings.ts's SLA clock. */
  slaBreachAt: epochMsSchema,
  /** Set once sendDisputeSlaBreachWarnings.ts fires its warning — gates the repeat, same pattern as subOrder.slaWarningSentAt. */
  slaWarningSentAt: epochMsSchema.optional(),
  resolution: disputeResolutionSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Dispute = z.infer<typeof disputeSchema>

export const disputeConverter = makeFirestoreConverter(disputeSchema)

export const openDisputeRequestSchema = z.object({
  type: disputeTypeSchema,
  returnId: returnIdSchema.optional(),
  warrantyClaimId: warrantyClaimIdSchema.optional(),
  orderId: orderIdSchema,
  subOrderId: subOrderIdSchema,
  reasonNotes: z.string().min(1).max(2000),
})
export type OpenDisputeRequest = z.infer<typeof openDisputeRequestSchema>

export const openDisputeResultSchema = z.object({
  disputeId: disputeIdSchema,
})
export type OpenDisputeResult = z.infer<typeof openDisputeResultSchema>

export const addDisputeEvidenceRequestSchema = z.object({
  disputeId: disputeIdSchema,
  url: z.string().min(1),
  note: z.string().max(500).optional(),
})
export type AddDisputeEvidenceRequest = z.infer<typeof addDisputeEvidenceRequestSchema>

export const resolveDisputeRequestSchema = z.object({
  disputeId: disputeIdSchema,
  action: disputeResolutionActionSchema,
  refundAmountPaise: z.number().int().nonnegative().optional(),
  adminNote: z.string().min(1).max(2000),
})
export type ResolveDisputeRequest = z.infer<typeof resolveDisputeRequestSchema>

export const resolveDisputeResultSchema = z.object({
  disputeId: disputeIdSchema,
  status: disputeStatusSchema,
})
export type ResolveDisputeResult = z.infer<typeof resolveDisputeResultSchema>
