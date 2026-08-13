import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { rfqIdSchema, rfqMessageIdSchema, rfqQuoteIdSchema, sellerIdSchema, userIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const rfqMessageSenderRoleSchema = z.enum(['buyer', 'seller'])
export type RfqMessageSenderRole = z.infer<typeof rfqMessageSenderRoleSchema>

/**
 * One private thread per (rfq, seller) quote — not one shared thread per rfq — so a
 * seller's negotiation is never visible to a competing seller quoting on the same
 * RFQ. Lives at `rfqQuotes/{quoteId}/messages/{messageId}`. `buyerId`/`sellerId` are
 * denormalized from the parent quote so firestore.rules can scope reads without a
 * get(). Cloud-Function-only writes (sendRfqMessage.ts) — the body is moderated for
 * phone numbers/emails server-side before it's ever persisted (see
 * validators/messageContent.ts).
 */
export const rfqMessageSchema = z.object({
  id: rfqMessageIdSchema,
  rfqId: rfqIdSchema,
  quoteId: rfqQuoteIdSchema,
  buyerId: userIdSchema,
  sellerId: sellerIdSchema,
  senderRole: rfqMessageSenderRoleSchema,
  senderId: userIdSchema,
  body: z.string().min(1).max(2000),
  attachments: z.array(z.string().url()).default([]),
  createdAt: epochMsSchema,
})
export type RfqMessage = z.infer<typeof rfqMessageSchema>

export const rfqMessageConverter = makeFirestoreConverter(rfqMessageSchema)
