import { z } from 'zod'
import { partTypeSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import { partIdSchema, sellerIdSchema, userIdSchema } from '../ids'
import { hsnSchema } from '../validators/indian'
import { gstRatePercentSchema } from './catalogPart'
import { callableRequestSchema, epochMsSchema } from './common'

export const partRequestIdSchema = z.string().min(1)
export type PartRequestId = z.infer<typeof partRequestIdSchema>

export const partRequestStatusSchema = z.enum(['pending', 'under_review', 'changes_requested', 'approved', 'rejected'])
export type PartRequestStatus = z.infer<typeof partRequestStatusSchema>

export const partRequestReviewNoteSchema = z.object({
  message: z.string().min(1),
  createdAt: epochMsSchema,
})
export type PartRequestReviewNote = z.infer<typeof partRequestReviewNoteSchema>

/**
 * A seller-submitted proposal for a SKU missing from the master catalogue
 * (requirement 2). Deliberately lighter-weight than `catalogPartSchema`
 * itself — no `oemNumbers[]`/`crossRefNumbers[]` arrays or structured
 * `fitmentSummary` (that needs real `catalogFitments` rows, an admin-only
 * system a seller has no path into) — just enough for an admin reviewer to
 * act on. `hsnCode`/`gstRatePercent` are the seller's best guess, always
 * admin-confirmed (and overridable) at approval time — see
 * `reviewPartRequestRequestSchema`.
 */
export const partRequestSchema = z.object({
  id: partRequestIdSchema,
  sellerId: sellerIdSchema,
  title: z.string().min(1),
  brand: z.string().optional(),
  oemNumber: z.string().optional(),
  partType: partTypeSchema,
  categorySlug: z.string().min(1),
  subcategorySlug: z.string().optional(),
  description: z.string().max(2000).optional(),
  images: z.array(z.string().url()).default([]),
  /** Free-text spec key/values the seller knows offhand (e.g. "Material: Ceramic") — not the catalogue's own `attributes` shape, just a hint for the admin filling that in. */
  attributes: z.record(z.string(), z.string()).default({}),
  /** Free-text vehicle/fitment description — a real `catalogFitments` link is created by the admin separately, this is only ever a hint. */
  fitmentNotes: z.string().max(1000).optional(),
  hsnCode: hsnSchema.optional(),
  gstRatePercent: gstRatePercentSchema.optional(),
  status: partRequestStatusSchema,
  reviewNotes: z.array(partRequestReviewNoteSchema).default([]),
  reviewedBy: userIdSchema.optional(),
  reviewedAt: epochMsSchema.optional(),
  /** Set on approve — the new catalogParts/{id} and the seller's auto-linked draft listing. */
  linkedPartId: partIdSchema.optional(),
  linkedListingId: z.string().optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type PartRequest = z.infer<typeof partRequestSchema>

export const partRequestConverter = makeFirestoreConverter(partRequestSchema)

export const submitPartRequestRequestSchema = callableRequestSchema(
  partRequestSchema.omit({
    id: true,
    sellerId: true,
    status: true,
    reviewNotes: true,
    reviewedBy: true,
    reviewedAt: true,
    linkedPartId: true,
    linkedListingId: true,
    createdAt: true,
    updatedAt: true,
  }),
)
export type SubmitPartRequestRequest = z.infer<typeof submitPartRequestRequestSchema>

export const submitPartRequestResultSchema = z.object({ id: partRequestIdSchema })
export type SubmitPartRequestResult = z.infer<typeof submitPartRequestResultSchema>

export const reviewPartRequestActionSchema = z.enum(['start_review', 'request_changes', 'reject', 'approve'])
export type ReviewPartRequestAction = z.infer<typeof reviewPartRequestActionSchema>

export const reviewPartRequestRequestSchema = callableRequestSchema(
  z.object({
    requestId: partRequestIdSchema,
    action: reviewPartRequestActionSchema,
    /** Required for request_changes; optional context for reject. */
    message: z.string().max(500).optional(),
    /** approve-only: admin-confirmed final catalogue values, defaulting to the seller's own submission client-side but always explicitly confirmed here rather than silently trusted. */
    approvedPartNumber: z.string().min(1).optional(),
    approvedHsnCode: hsnSchema.optional(),
    approvedGstRatePercent: gstRatePercentSchema.optional(),
  }),
)
export type ReviewPartRequestRequest = z.infer<typeof reviewPartRequestRequestSchema>

export const reviewPartRequestResultSchema = z.object({
  status: partRequestStatusSchema,
  linkedPartId: partIdSchema.optional(),
  linkedListingId: z.string().optional(),
})
export type ReviewPartRequestResult = z.infer<typeof reviewPartRequestResultSchema>
