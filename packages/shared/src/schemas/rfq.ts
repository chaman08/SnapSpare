import { z } from 'zod'
import { buyerTypeSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import {
  orderIdSchema,
  partIdSchema,
  rfqIdSchema,
  rfqQuoteIdSchema,
  sellerIdSchema,
  userIdSchema,
  vehicleVariantIdSchema,
} from '../ids'
import { pincodeSchema } from '../validators/indian'
import { epochMsSchema } from './common'

export const rfqStatusSchema = z.enum(['open', 'quoted', 'accepted', 'converted', 'expired', 'withdrawn'])
export type RfqStatus = z.infer<typeof rfqStatusSchema>

export const rfqSchema = z.object({
  id: rfqIdSchema,
  buyerId: userIdSchema,
  buyerType: buyerTypeSchema,
  partId: partIdSchema.optional(),
  freeTextDescription: z.string().optional(),
  categorySlug: z.string().optional(),
  qtyRequested: z.number().int().positive(),
  targetPricePaise: z.number().int().nonnegative().optional(),
  vehicleVariantId: vehicleVariantIdSchema.optional(),
  deliveryPincode: pincodeSchema,
  requiredByDate: epochMsSchema.optional(),
  notes: z.string().max(1000).optional(),
  status: rfqStatusSchema,
  attachments: z.array(z.string().url()).default([]),
  /** Sellers matched by matchSellersForRfq (functions/src/rfq/routing.ts) and notified — the seller inbox's `/seller/rfqs` query is `routedSellerIds array-contains sellerId`. */
  routedSellerIds: z.array(sellerIdSchema).default([]),
  /** Set at creation by matchSellersForRfq — quotes submitted after this instant are rejected by submitRfqQuote.ts, and expireRfqs.ts closes the RFQ once it passes with no accepted quote. */
  responseDeadline: epochMsSchema.optional(),
  /** Denormalized count of `rfqQuotes` docs for this rfqId, kept in sync by submitRfqQuote.ts — lets list views show a quote count without a second query. */
  quoteCount: z.number().int().nonnegative().default(0),
  acceptedQuoteId: rfqQuoteIdSchema.optional(),
  orderId: orderIdSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Rfq = z.infer<typeof rfqSchema>

export const rfqConverter = makeFirestoreConverter(rfqSchema)
