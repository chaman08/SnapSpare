import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import {
  listingIdSchema,
  orderIdSchema,
  partIdSchema,
  sellerIdSchema,
  spuriousReportIdSchema,
  subOrderIdSchema,
  userIdSchema,
} from '../ids'
import { epochMsSchema } from './common'

export const MAX_SPURIOUS_REPORT_EVIDENCE_IMAGES = 6

export const spuriousReportStatusSchema = z.enum([
  'submitted',
  'under_review',
  'seller_responded',
  'resolved',
])
export type SpuriousReportStatus = z.infer<typeof spuriousReportStatusSchema>

/**
 * The penalty ladder (design spec item 4): each outcome maps to exactly one
 * server-side effect in functions/src/trust/resolveSpuriousReport.ts —
 * warning (counters only), listing_removal (that listing's status ->
 * 'rejected'), category_ban (categorySlug appended to the seller's
 * bannedCategorySlugs), payout_hold (seller.payoutHold = true, excluded from
 * runSellerPayouts.ts), delisting (seller.status -> 'suspended', which
 * onSellerStatusChange.ts already turns into a claims revocation), or
 * dismissed (no penalty).
 */
export const spuriousReportOutcomeSchema = z.enum([
  'warning',
  'listing_removal',
  'category_ban',
  'payout_hold',
  'delisting',
  'dismissed',
])
export type SpuriousReportOutcome = z.infer<typeof spuriousReportOutcomeSchema>

export const spuriousReportSellerResponseSchema = z.object({
  comment: z.string().min(1),
  respondedAt: epochMsSchema,
})
export type SpuriousReportSellerResponse = z.infer<typeof spuriousReportSellerResponseSchema>

export const spuriousReportSchema = z.object({
  id: spuriousReportIdSchema,
  reporterId: userIdSchema,
  orderId: orderIdSchema.optional(),
  subOrderId: subOrderIdSchema.optional(),
  listingId: listingIdSchema,
  partId: partIdSchema,
  sellerId: sellerIdSchema,
  reasonNotes: z.string().min(1).max(2000),
  evidenceImages: z.array(z.string().min(1)).max(MAX_SPURIOUS_REPORT_EVIDENCE_IMAGES).default([]),
  status: spuriousReportStatusSchema,
  sellerResponse: spuriousReportSellerResponseSchema.optional(),
  adminNotes: z.string().optional(),
  outcome: spuriousReportOutcomeSchema.optional(),
  resolvedBy: userIdSchema.optional(),
  resolvedAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type SpuriousReport = z.infer<typeof spuriousReportSchema>

export const spuriousReportConverter = makeFirestoreConverter(spuriousReportSchema)

export const reportSpuriousPartRequestSchema = spuriousReportSchema.pick({
  orderId: true,
  subOrderId: true,
  listingId: true,
  partId: true,
  sellerId: true,
  reasonNotes: true,
  evidenceImages: true,
})
export type ReportSpuriousPartRequest = z.infer<typeof reportSpuriousPartRequestSchema>

export const respondToSpuriousReportRequestSchema = z.object({
  id: spuriousReportIdSchema,
  comment: z.string().min(1).max(2000),
})
export type RespondToSpuriousReportRequest = z.infer<typeof respondToSpuriousReportRequestSchema>

export const resolveSpuriousReportRequestSchema = z.discriminatedUnion('action', [
  z.object({ id: spuriousReportIdSchema, action: z.literal('start_review') }),
  z.object({
    id: spuriousReportIdSchema,
    action: z.literal('resolve'),
    outcome: spuriousReportOutcomeSchema,
    adminNotes: z.string().max(2000).optional(),
  }),
])
export type ResolveSpuriousReportRequest = z.infer<typeof resolveSpuriousReportRequestSchema>
