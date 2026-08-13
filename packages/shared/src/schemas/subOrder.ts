import { z } from 'zod'
import { subOrderStatusSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import {
  invoiceIdSchema,
  listingIdSchema,
  orderIdSchema,
  partIdSchema,
  payoutIdSchema,
  returnIdSchema,
  sellerIdSchema,
  subOrderIdSchema,
  userIdSchema,
} from '../ids'
import { hsnSchema } from '../validators/indian'
import { addressSnapshotSchema, epochMsSchema } from './common'
import { gstRatePercentSchema } from './catalogPart'
import { timelineEntrySchema } from './orderTimeline'
import { ndrInfoSchema, pickupDateSchema } from './shipping'

export const subOrderItemSchema = z.object({
  listingId: listingIdSchema,
  partId: partIdSchema,
  sku: z.string().min(1),
  title: z.string().min(1),
  qty: z.number().int().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  tierMinQtyApplied: z.number().int().positive(),
  hsnCode: hsnSchema,
  gstRatePercent: gstRatePercentSchema,
  lineSubtotalPaise: z.number().int().nonnegative(),
  lineDiscountPaise: z.number().int().nonnegative(),
  lineTaxPaise: z.number().int().nonnegative(),
  lineTotalPaise: z.number().int().nonnegative(),
  /** Copied from the buyer's cart line at order-placement time (see createOrder.ts) — the garage vehicle active when this listing was added to cart, if any. Feeds the review flow's auto-filled "Fitted to: X" (see reviewEligibilitySchema). */
  vehicleId: z.string().min(1).optional(),
  vehicleLabel: z.string().min(1).optional(),
})
export type SubOrderItem = z.infer<typeof subOrderItemSchema>

export const shipmentInfoSchema = z.object({
  awb: z.string().optional(),
  courier: z.string().optional(),
  shiprocketOrderId: z.string().optional(),
  shippedAt: epochMsSchema.optional(),
  deliveredAt: epochMsSchema.optional(),
  /** Set by bookShipment.ts once the provider adapter's createShipment() succeeds — distinct from `shiprocketOrderId` above (Phase 9's placeholder field, kept for backward compatibility) since a mock-provider booking in dev never populates that one. */
  providerShipmentId: z.string().optional(),
  providerOrderId: z.string().optional(),
  /** Signed Storage URL from generateShippingLabel.ts — expires; regenerate rather than caching long-term. */
  labelUrl: z.string().url().optional(),
  labelGeneratedAt: epochMsSchema.optional(),
  pickupScheduledAt: epochMsSchema.optional(),
  pickupDate: pickupDateSchema.optional(),
  /** Raw provider status string as of the last webhook/reconciliation pass — compared against on the next tracking update so an unchanged status is a no-op. */
  lastTrackedStatus: z.string().optional(),
  lastTrackedAt: epochMsSchema.optional(),
  ndr: ndrInfoSchema.optional(),
})
export type ShipmentInfo = z.infer<typeof shipmentInfoSchema>

export const subOrderSchema = z.object({
  id: subOrderIdSchema,
  orderId: orderIdSchema,
  buyerId: userIdSchema,
  sellerId: sellerIdSchema,
  status: subOrderStatusSchema,
  /** Flat, deduped list of every partId in `items` — denormalized purely so answerQuestion.ts (Phase 17 Q&A) can authorize "a buyer who purchased this part" with an `array-contains` query instead of scanning nested item arrays, which Firestore can't query into. */
  purchasedPartIds: z.array(partIdSchema).default([]),
  /** Copied from the parent order at creation time (one order has exactly one delivery address, shared by every seller in it) so the owning seller — who can read this doc but never the parent `orders/{orderId}` doc, see firestore.rules — has what they need to ship the physical package and print a packing slip. */
  shippingAddress: addressSnapshotSchema,
  items: z.array(subOrderItemSchema).min(1),
  subtotalPaise: z.number().int().nonnegative(),
  discountPaise: z.number().int().nonnegative(),
  taxPaise: z.number().int().nonnegative(),
  shippingPaise: z.number().int().nonnegative(),
  totalPaise: z.number().int().nonnegative(),
  isInterState: z.boolean(),
  cgstPaise: z.number().int().nonnegative(),
  sgstPaise: z.number().int().nonnegative(),
  igstPaise: z.number().int().nonnegative(),
  /** Snapshotted from priceCart's shipping estimate at order placement time — shown on the confirmation screen and order detail page. Absent when the seller's shipping zone couldn't be resolved (see priceCart.ts). */
  etaDaysMin: z.number().int().positive().optional(),
  etaDaysMax: z.number().int().positive().optional(),
  shipment: shipmentInfoSchema.optional(),
  /** Set together, once, by functions/src/tax/generateInvoiceOnShipped.ts the moment status becomes 'shipped'. `invoiceId` points at the full `invoices/{invoiceId}` doc (line items, party snapshots, tax split); `invoiceNumber` is denormalised here for display without a second read; `invoiceUrl` is a signed Storage URL cached at generation time — it expires, so getInvoiceUrl.ts (which takes `invoiceId`) is the reliable path once it's stale. */
  invoiceId: invoiceIdSchema.optional(),
  invoiceNumber: z.string().optional(),
  invoiceUrl: z.string().url().optional(),
  /** Append-only status-change audit trail — every transitionSubOrder-family Cloud Function pushes exactly one entry, oldest first. Powers the buyer order-detail vertical timeline. */
  timeline: z.array(timelineEntrySchema).default([]),
  /** Deadline for the seller to accept this subOrder (set once the parent order is confirmed — see paymentTransition.ts/createOrder.ts), consumed by autoCancelUnacceptedSubOrders. Absent while the order is still pending_payment. Cleared once status leaves 'pending'. */
  slaAcceptByAt: epochMsSchema.optional(),
  /** Set true only by autoCancelUnacceptedSubOrders when this subOrder is cancelled for missing slaAcceptByAt — distinguishes an SLA-driven auto-cancel from a buyer/seller-initiated one for seller scorecards. */
  slaBreached: z.boolean().default(false),
  /** Set once by functions/src/notifications/sendSlaBreachWarnings.ts when it warns the seller their accept-by deadline is close — gates the warning to fire once per subOrder, same pattern as creditDueReminders.ts's beforeReminderSentAt. */
  slaWarningSentAt: epochMsSchema.optional(),
  /**
   * Commission + payout fields, set once by
   * functions/src/payments/applyCommissionOnDelivered.ts the moment status
   * becomes 'delivered' (Phase 12 — commission is applied at delivery, not
   * order placement). `tcsPaise`/`tdsPaise` are denormalized copies of the
   * amounts already posted to the ledger at invoice/shipped time (read back
   * out of `ledgers/{sellerId}/entries` at delivery time) so
   * `netPayableToSellerPaise` and the payout run never need to re-derive
   * money math from scattered ledger entries across two different trigger
   * timings. `payoutId` is stamped by runSellerPayouts.ts once this
   * subOrder's net amount has been included in a payout — absent means not
   * yet paid out.
   */
  commissionPaise: z.number().int().nonnegative().optional(),
  tcsPaise: z.number().int().nonnegative().optional(),
  tdsPaise: z.number().int().nonnegative().optional(),
  netPayableToSellerPaise: z.number().int().optional(),
  /** Explicitly `null` (not merely absent) once commissioned and awaiting payout, set by applyCommissionOnDelivered.ts, so runSellerPayouts.ts's `where('payoutId', '==', null)` query — which cannot match a genuinely-missing field — finds it. Becomes the payout doc id once paid out. */
  payoutId: payoutIdSchema.nullable().optional(),
  /** Set only on a zero-value sub-order created by functions/src/orders/resolveReturnQcPass.ts when a return's resolutionPreference is 'replacement'. All paise fields on such a sub-order are 0 — it still flows through the normal accept/pack/ship/deliver pipeline, but postLedgerEntries skips zero-amount entries and applyCommissionOnDelivered computes 0 commission, so no other code needs to special-case it. */
  isReplacement: z.boolean().default(false),
  /** The original (returned) sub-order this replacement was created for — only set when isReplacement is true. */
  replacementForSubOrderId: subOrderIdSchema.optional(),
  /** The return doc that triggered this replacement — only set when isReplacement is true. */
  originReturnId: returnIdSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type SubOrder = z.infer<typeof subOrderSchema>

export const subOrderConverter = makeFirestoreConverter(subOrderSchema)
