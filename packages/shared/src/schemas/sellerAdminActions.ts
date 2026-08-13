import { z } from 'zod'
import { sellerStatusSchema } from '../enums'
import { sellerIdSchema } from '../ids'

/**
 * Admin actions on an already-approved seller (Sellers module, distinct
 * from the approval-queue flow in reviewSellerApplication.ts). `suspend`
 * requires a reason (shown to the seller and kept in the audit trail);
 * `setCommission` with `commissionRatePercent: null` clears the per-seller
 * override so `sellerSchema.commissionRatePercent`'s absence falls back to
 * `config/commission`'s platform default, per getCommissionRatePreview.ts.
 */
export const adminUpdateSellerRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('suspend'), sellerId: sellerIdSchema, reason: z.string().min(1) }),
  z.object({ action: z.literal('reinstate'), sellerId: sellerIdSchema }),
  z.object({
    action: z.literal('setCommission'),
    sellerId: sellerIdSchema,
    commissionRatePercent: z.number().min(0).max(100).nullable(),
  }),
])
export type AdminUpdateSellerRequest = z.infer<typeof adminUpdateSellerRequestSchema>

export const adminUpdateSellerResultSchema = z.object({
  sellerId: sellerIdSchema,
  status: sellerStatusSchema,
  commissionRatePercent: z.number().nullable().optional(),
})
export type AdminUpdateSellerResult = z.infer<typeof adminUpdateSellerResultSchema>
