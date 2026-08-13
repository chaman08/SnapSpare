import { z } from 'zod'
import { warrantyClaimReasonSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import {
  listingIdSchema,
  orderIdSchema,
  partIdSchema,
  sellerIdSchema,
  subOrderIdSchema,
  userIdSchema,
  warrantyClaimIdSchema,
} from '../ids'
import { epochMsSchema } from './common'

export const MAX_WARRANTY_CLAIM_EVIDENCE_IMAGES = 6

/**
 * `submitted` -> seller_review (seller opens it) -> approved/rejected.
 * `escalated_to_brand` is admin-mediated only (no brand-contact directory
 * exists — see decideWarrantyClaim.ts's header comment): a seller or admin
 * flips it here, an admin handles the actual brand contact offline, and
 * `resolve` (admin only) closes it out as `resolved`.
 */
export const warrantyClaimStatusSchema = z.enum([
  'submitted',
  'seller_review',
  'approved',
  'rejected',
  'escalated_to_brand',
  'resolved',
])
export type WarrantyClaimStatus = z.infer<typeof warrantyClaimStatusSchema>

export const warrantyClaimResolutionTypeSchema = z.enum(['refund', 'replacement', 'repair_reimbursement'])
export type WarrantyClaimResolutionType = z.infer<typeof warrantyClaimResolutionTypeSchema>

export const warrantyClaimSellerDecisionSchema = z.object({
  outcome: z.enum(['approved', 'rejected']),
  note: z.string().max(1000).optional(),
  decidedAt: epochMsSchema,
})
export type WarrantyClaimSellerDecision = z.infer<typeof warrantyClaimSellerDecisionSchema>

export const warrantyClaimResolutionSchema = z.object({
  type: warrantyClaimResolutionTypeSchema,
  amountPaise: z.number().int().nonnegative().optional(),
  note: z.string().max(1000),
  resolvedBy: userIdSchema,
  resolvedAt: epochMsSchema,
})
export type WarrantyClaimResolution = z.infer<typeof warrantyClaimResolutionSchema>

export const warrantyClaimSchema = z.object({
  id: warrantyClaimIdSchema,
  orderId: orderIdSchema,
  subOrderId: subOrderIdSchema,
  listingId: listingIdSchema,
  partId: partIdSchema,
  /** Denormalized from catalogParts/{partId}.partNumber at claim time — displayed in IBM Plex Mono per design system, and what onWarrantyClaimWrite.ts rolls up claim counts against for the seller/admin "which listings to demote" view. */
  partNumber: z.string().min(1),
  buyerId: userIdSchema,
  sellerId: sellerIdSchema,
  reason: warrantyClaimReasonSchema,
  description: z.string().min(1).max(2000),
  /** Always required — a warranty claim without photo evidence isn't actionable by the seller/brand. */
  evidenceImages: z.array(z.string().min(1)).min(1).max(MAX_WARRANTY_CLAIM_EVIDENCE_IMAGES),
  evidenceVideoPath: z.string().min(1).optional(),
  status: warrantyClaimStatusSchema,
  sellerDecision: warrantyClaimSellerDecisionSchema.optional(),
  escalatedToBrandAt: epochMsSchema.optional(),
  /** Copied from catalogParts/{partId}.brand (free text — see the schema's header comment; there is no brand-contact directory in this system) at claim time, for the admin escalation queue. */
  brandName: z.string().optional(),
  resolution: warrantyClaimResolutionSchema.optional(),
  claimedAt: epochMsSchema,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type WarrantyClaim = z.infer<typeof warrantyClaimSchema>

export const warrantyClaimConverter = makeFirestoreConverter(warrantyClaimSchema)

export const submitWarrantyClaimRequestSchema = z.object({
  subOrderId: subOrderIdSchema,
  listingId: listingIdSchema,
  reason: warrantyClaimReasonSchema,
  description: z.string().min(1).max(2000),
  evidenceImages: z.array(z.string().min(1)).min(1).max(MAX_WARRANTY_CLAIM_EVIDENCE_IMAGES),
  evidenceVideoPath: z.string().min(1).optional(),
})
export type SubmitWarrantyClaimRequest = z.infer<typeof submitWarrantyClaimRequestSchema>

export const submitWarrantyClaimResultSchema = z.object({
  claimId: warrantyClaimIdSchema,
})
export type SubmitWarrantyClaimResult = z.infer<typeof submitWarrantyClaimResultSchema>

export const decideWarrantyClaimRequestSchema = z.discriminatedUnion('action', [
  z.object({ claimId: warrantyClaimIdSchema, action: z.literal('approve'), note: z.string().max(1000).optional() }),
  z.object({ claimId: warrantyClaimIdSchema, action: z.literal('reject'), note: z.string().max(1000).optional() }),
  z.object({ claimId: warrantyClaimIdSchema, action: z.literal('escalate_to_brand') }),
  z.object({
    claimId: warrantyClaimIdSchema,
    action: z.literal('resolve'),
    resolutionType: warrantyClaimResolutionTypeSchema,
    amountPaise: z.number().int().nonnegative().optional(),
    note: z.string().min(1).max(1000),
  }),
])
export type DecideWarrantyClaimRequest = z.infer<typeof decideWarrantyClaimRequestSchema>

export const decideWarrantyClaimResultSchema = z.object({
  claimId: warrantyClaimIdSchema,
  status: warrantyClaimStatusSchema,
})
export type DecideWarrantyClaimResult = z.infer<typeof decideWarrantyClaimResultSchema>
