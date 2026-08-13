import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { orderIdSchema, supportTicketIdSchema, userIdSchema } from '../ids'
import { mobileSchema } from '../validators/indian'
import { callableRequestSchema, epochMsSchema } from './common'

/**
 * Phase 24 (launch readiness): the contact-form ticketing system behind
 * `/support`. Modelled directly on `dispute.ts` — a status machine, an SLA
 * clock (`slaBreachAt`/`slaWarningSentAt`, same gated-repeat pattern as
 * `sendDisputeSlaBreachWarnings.ts`), and a flat message timeline instead of
 * a subcollection so the whole thread loads in one read.
 */
export const supportTicketCategorySchema = z.enum([
  'order_issue',
  'payment_issue',
  'return_refund',
  'seller_conduct',
  'account_access',
  'listing_or_pricing',
  'other',
])
export type SupportTicketCategory = z.infer<typeof supportTicketCategorySchema>

export const supportTicketStatusSchema = z.enum(['open', 'in_progress', 'resolved', 'closed'])
export type SupportTicketStatus = z.infer<typeof supportTicketStatusSchema>

export const supportTicketMessageSchema = z.object({
  /** Absent `authorUserId` + `authorRole: 'buyer'` marks a guest submission (contact form, not signed in) — see createSupportTicket.ts. */
  authorRole: z.enum(['buyer', 'seller', 'admin']),
  authorUserId: userIdSchema.optional(),
  body: z.string().min(1).max(4000),
  createdAt: epochMsSchema,
})
export type SupportTicketMessage = z.infer<typeof supportTicketMessageSchema>

export const supportTicketSchema = z.object({
  id: supportTicketIdSchema,
  /** Absent for a guest (not-signed-in) contact-form submission — see contactEmail/contactPhone below, which are always present as the reply channel either way. */
  userId: userIdSchema.optional(),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email().optional(),
  contactPhone: mobileSchema.optional(),
  category: supportTicketCategorySchema,
  subject: z.string().min(1).max(200),
  /** The related order, if the buyer picked one from their order history when filing — optional since many categories (account access, listing/pricing questions) aren't order-scoped. */
  orderId: orderIdSchema.optional(),
  status: supportTicketStatusSchema,
  messages: z.array(supportTicketMessageSchema).min(1),
  assignedTo: userIdSchema.optional(),
  /** now + config/app.supportTicketSlaHours at open time. */
  slaBreachAt: epochMsSchema,
  slaWarningSentAt: epochMsSchema.optional(),
  resolvedAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type SupportTicket = z.infer<typeof supportTicketSchema>

export const supportTicketConverter = makeFirestoreConverter(supportTicketSchema)

/** Contact form (public — guest or signed-in). At least one of email/phone is required so there's always a reply channel; enforced in createSupportTicket.ts rather than here since it's a cross-field rule already used elsewhere (see e.g. sellerApplicationTaxIdentitySchema). */
export const createSupportTicketRequestSchema = callableRequestSchema(
  z.object({
    contactName: z.string().min(1).max(200),
    contactEmail: z.string().email().optional(),
    contactPhone: mobileSchema.optional(),
    category: supportTicketCategorySchema,
    subject: z.string().min(1).max(200),
    message: z.string().min(1).max(4000),
    orderId: orderIdSchema.optional(),
  }),
)
export type CreateSupportTicketRequest = z.infer<typeof createSupportTicketRequestSchema>

export const createSupportTicketResultSchema = z.object({
  ticketId: supportTicketIdSchema,
  slaBreachAt: epochMsSchema,
})
export type CreateSupportTicketResult = z.infer<typeof createSupportTicketResultSchema>

/** Admin/support-staff reply — appends a message and moves `open` -> `in_progress` (a no-op status-wise on a ticket that's already in_progress/resolved/closed, reopening is a separate explicit action). */
export const respondToSupportTicketRequestSchema = z.object({
  ticketId: supportTicketIdSchema,
  body: z.string().min(1).max(4000),
})
export type RespondToSupportTicketRequest = z.infer<typeof respondToSupportTicketRequestSchema>

export const respondToSupportTicketResultSchema = z.object({
  ticketId: supportTicketIdSchema,
  status: supportTicketStatusSchema,
})
export type RespondToSupportTicketResult = z.infer<typeof respondToSupportTicketResultSchema>

export const resolveSupportTicketRequestSchema = z.object({
  ticketId: supportTicketIdSchema,
  status: z.enum(['resolved', 'closed']),
  /** Optional closing note appended to the thread as an admin message — not mandatory (unlike resolveDisputeRequestSchema's adminNote) since most tickets close with just a status flip after the last reply already said everything. */
  note: z.string().max(4000).optional(),
})
export type ResolveSupportTicketRequest = z.infer<typeof resolveSupportTicketRequestSchema>

export const resolveSupportTicketResultSchema = z.object({
  ticketId: supportTicketIdSchema,
  status: supportTicketStatusSchema,
})
export type ResolveSupportTicketResult = z.infer<typeof resolveSupportTicketResultSchema>
