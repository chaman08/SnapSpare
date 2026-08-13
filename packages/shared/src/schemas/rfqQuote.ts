import { z } from 'zod'
import { gstRatePercentSchema } from './catalogPart'
import { makeFirestoreConverter } from '../firestore/converter'
import { listingIdSchema, orderIdSchema, rfqIdSchema, rfqQuoteIdSchema, sellerIdSchema, userIdSchema } from '../ids'
import { hsnSchema } from '../validators/indian'
import { epochMsSchema } from './common'

export const rfqQuoteStatusSchema = z.enum(['pending', 'accepted', 'rejected', 'withdrawn', 'expired'])
export type RfqQuoteStatus = z.infer<typeof rfqQuoteStatusSchema>

export const rfqQuoteSchema = z.object({
  id: rfqQuoteIdSchema,
  rfqId: rfqIdSchema,
  sellerId: sellerIdSchema,
  /** Denormalized from the parent rfq at submit time so firestore.rules can scope a buyer's read/accept without a get() against `rfqs`. */
  buyerId: userIdSchema,
  /**
   * Denormalized from the seller doc at submit time (submitRfqQuote.ts) —
   * `sellers/{sellerId}` is Cloud-Function/owner/admin-only (see
   * firestore.rules), never buyer-readable, so the buyer's comparison view
   * (requirement 4: "seller ratings") has nothing else to render this from.
   * Same pattern as `PricedSellerGroup.sellerName`/`sellerRatingAvg` in
   * pricing/priceCart — a snapshot at submit time, not a live join.
   */
  sellerName: z.string().min(1),
  sellerRatingAvg: z.number().min(0).max(5),
  sellerRatingCount: z.number().int().nonnegative(),
  unitPricePaise: z.number().int().nonnegative(),
  qtyOffered: z.number().int().positive(),
  moq: z.number().int().positive().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
  /** An existing listing this seller is anchoring the quote to — its sku/title/hsnCode/gstRatePercent are read for reference at accept time, never rewritten (the negotiated price is never applied back onto the listing's own tiers). */
  listingId: listingIdSchema.optional(),
  /** Required by submitRfqQuote.ts (not by this schema) only when the parent rfq has no partId and this quote has no listingId — the only two other sources of tax info at accept time. */
  hsnCode: hsnSchema.optional(),
  gstRatePercent: gstRatePercentSchema.optional(),
  status: rfqQuoteStatusSchema,
  validUntil: epochMsSchema.optional(),
  orderId: orderIdSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type RfqQuote = z.infer<typeof rfqQuoteSchema>

export const rfqQuoteConverter = makeFirestoreConverter(rfqQuoteSchema)
