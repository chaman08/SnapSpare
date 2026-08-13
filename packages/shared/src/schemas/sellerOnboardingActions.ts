import { z } from 'zod'
import { pincodeSchema } from '../validators/indian'
import { sellerApplicationReviewNoteSchema } from './sellerApplication'

export const submitSellerApplicationResultSchema = z.object({
  status: z.literal('submitted'),
})
export type SubmitSellerApplicationResult = z.infer<typeof submitSellerApplicationResultSchema>

export const reviewSellerApplicationRequestSchema = z.object({
  applicationId: z.string().min(1),
  action: z.enum(['start_review', 'request_changes', 'approve', 'reject']),
  /** Required for request_changes (itemised reasons) and useful context for reject. Ignored for start_review/approve. */
  notes: z.array(sellerApplicationReviewNoteSchema.omit({ createdAt: true })).optional(),
  reason: z.string().max(500).optional(),
})
export type ReviewSellerApplicationRequest = z.infer<typeof reviewSellerApplicationRequestSchema>

export const reviewSellerApplicationResultSchema = z.object({
  status: z.enum(['under_review', 'changes_requested', 'approved', 'rejected']),
  sellerId: z.string().optional(),
})
export type ReviewSellerApplicationResult = z.infer<typeof reviewSellerApplicationResultSchema>

export const checkPickupPincodeServiceabilityRequestSchema = z.object({
  pincode: pincodeSchema,
})
export type CheckPickupPincodeServiceabilityRequest = z.infer<typeof checkPickupPincodeServiceabilityRequestSchema>

export const checkPickupPincodeServiceabilityResultSchema = z.object({
  pincode: pincodeSchema,
  serviceable: z.boolean(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().optional(),
})
export type CheckPickupPincodeServiceabilityResult = z.infer<typeof checkPickupPincodeServiceabilityResultSchema>
