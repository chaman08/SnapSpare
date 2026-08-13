import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { refundBankDetailIdSchema, returnIdSchema, userIdSchema } from '../ids'
import { ifscSchema } from '../validators/indian'
import { epochMsSchema } from './common'

export const refundBankDetailStatusSchema = z.enum(['pending', 'used'])
export type RefundBankDetailStatus = z.infer<typeof refundBankDetailStatusSchema>

/**
 * A buyer-submitted bank account to receive a COD refund — there's no
 * card/UPI/netbanking instrument to reverse a refund to on a Cash on
 * Delivery order, so the refund engine (functions/src/payments/refundEngine.ts)
 * asks the buyer for one via submitRefundBankDetails.ts before it can call
 * the payout provider. Scoped to a single return; a buyer with several COD
 * returns submits bank details once per return (kept simple rather than a
 * reusable "saved bank account" concept, which this phase doesn't need).
 */
export const refundBankDetailSchema = z.object({
  id: refundBankDetailIdSchema,
  buyerId: userIdSchema,
  returnId: returnIdSchema,
  accountHolderName: z.string().min(1),
  accountNumber: z.string().min(4),
  ifsc: ifscSchema,
  bankName: z.string().min(1),
  status: refundBankDetailStatusSchema,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type RefundBankDetail = z.infer<typeof refundBankDetailSchema>

export const refundBankDetailConverter = makeFirestoreConverter(refundBankDetailSchema)
