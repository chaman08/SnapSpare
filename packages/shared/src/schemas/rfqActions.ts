import { z } from 'zod'
import { billingDetailsSchema, checkoutPaymentMethodSchema, createOrderResultSchema } from './checkout'
import { epochMsSchema } from './common'
import { gstRatePercentSchema } from './catalogPart'
import {
  addressIdSchema,
  listingIdSchema,
  partIdSchema,
  rfqIdSchema,
  rfqMessageIdSchema,
  rfqQuoteIdSchema,
  vehicleVariantIdSchema,
} from '../ids'
import { hsnSchema, pincodeSchema } from '../validators/indian'

// ---------------------------------------------------------------------------
// createRfq
// ---------------------------------------------------------------------------

export const createRfqRequestSchema = z
  .object({
    partId: partIdSchema.optional(),
    freeTextDescription: z.string().min(1).max(500).optional(),
    categorySlug: z.string().min(1).optional(),
    qtyRequested: z.number().int().positive(),
    targetPricePaise: z.number().int().nonnegative().optional(),
    vehicleVariantId: vehicleVariantIdSchema.optional(),
    deliveryPincode: pincodeSchema,
    requiredByDate: epochMsSchema.optional(),
    notes: z.string().max(1000).optional(),
    attachments: z.array(z.string().url()).max(6).default([]),
  })
  .refine((v) => Boolean(v.partId) || Boolean(v.freeTextDescription), {
    message: 'Provide a catalogue part or a free-text description of the part',
    path: ['freeTextDescription'],
  })
  .refine((v) => Boolean(v.partId) || Boolean(v.categorySlug), {
    message: 'A category is required when no catalogue part is selected',
    path: ['categorySlug'],
  })
export type CreateRfqRequest = z.infer<typeof createRfqRequestSchema>

export const createRfqResultSchema = z.object({
  rfqId: rfqIdSchema,
  routedSellerCount: z.number().int().nonnegative(),
})
export type CreateRfqResult = z.infer<typeof createRfqResultSchema>

// ---------------------------------------------------------------------------
// withdrawRfq
// ---------------------------------------------------------------------------

export const withdrawRfqRequestSchema = z.object({ rfqId: rfqIdSchema })
export type WithdrawRfqRequest = z.infer<typeof withdrawRfqRequestSchema>

// ---------------------------------------------------------------------------
// submitRfqQuote / withdrawRfqQuote
// ---------------------------------------------------------------------------

export const submitRfqQuoteRequestSchema = z.object({
  rfqId: rfqIdSchema,
  unitPricePaise: z.number().int().positive(),
  /** The seller's counter-quantity — "I can do 80 at this price" — may differ from the rfq's qtyRequested. */
  qtyOffered: z.number().int().positive(),
  moq: z.number().int().positive().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
  listingId: listingIdSchema.optional(),
  hsnCode: hsnSchema.optional(),
  gstRatePercent: gstRatePercentSchema.optional(),
  validUntil: epochMsSchema,
})
export type SubmitRfqQuoteRequest = z.infer<typeof submitRfqQuoteRequestSchema>

export const submitRfqQuoteResultSchema = z.object({ quoteId: rfqQuoteIdSchema })
export type SubmitRfqQuoteResult = z.infer<typeof submitRfqQuoteResultSchema>

export const withdrawRfqQuoteRequestSchema = z.object({ quoteId: rfqQuoteIdSchema })
export type WithdrawRfqQuoteRequest = z.infer<typeof withdrawRfqQuoteRequestSchema>

// ---------------------------------------------------------------------------
// acceptRfqQuote — converts a quote into a normal order with a locked,
// negotiated one-off price on the order line. Reuses the same payment-method
// surface as checkout (see checkout.ts's createOrderRequestSchema).
// ---------------------------------------------------------------------------

export const acceptRfqQuoteRequestSchema = z.object({
  idempotencyKey: z.string().min(10).max(128),
  rfqId: rfqIdSchema,
  quoteId: rfqQuoteIdSchema,
  shippingAddressId: addressIdSchema,
  billing: billingDetailsSchema.optional(),
  paymentMethod: checkoutPaymentMethodSchema,
})
export type AcceptRfqQuoteRequest = z.infer<typeof acceptRfqQuoteRequestSchema>

export const acceptRfqQuoteResultSchema = createOrderResultSchema
export type AcceptRfqQuoteResult = z.infer<typeof acceptRfqQuoteResultSchema>

// ---------------------------------------------------------------------------
// sendRfqMessage
// ---------------------------------------------------------------------------

export const sendRfqMessageRequestSchema = z.object({
  quoteId: rfqQuoteIdSchema,
  body: z.string().min(1).max(2000),
  attachments: z.array(z.string().url()).max(6).default([]),
})
export type SendRfqMessageRequest = z.infer<typeof sendRfqMessageRequestSchema>

export const sendRfqMessageResultSchema = z.object({ messageId: rfqMessageIdSchema })
export type SendRfqMessageResult = z.infer<typeof sendRfqMessageResultSchema>
