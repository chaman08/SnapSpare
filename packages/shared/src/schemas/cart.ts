import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { cartIdSchema, listingIdSchema, partIdSchema, sellerIdSchema, userIdSchema } from '../ids'
import { epochMsSchema } from './common'

/**
 * unitPricePaise/tierMinQtyApplied are a display-only snapshot taken when the
 * item was added — final pricing is always recomputed server-side at
 * checkout, never trusted from the client.
 */
export const cartItemSchema = z.object({
  listingId: listingIdSchema,
  partId: partIdSchema,
  sellerId: sellerIdSchema,
  qty: z.number().int().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  tierMinQtyApplied: z.number().int().positive(),
  /** Denormalized from the buyer's activeVehicleStore selection at add-to-cart time (see apps/web/src/features/cart/api/addToCart.ts) — carried through to the order so a review can auto-fill "Fitted to: X" without asking the buyer again. Absent when nothing was selected. */
  vehicleId: z.string().min(1).optional(),
  vehicleLabel: z.string().min(1).optional(),
  addedAt: epochMsSchema,
})
export type CartItem = z.infer<typeof cartItemSchema>

export const cartSellerGroupSchema = z.object({
  sellerId: sellerIdSchema,
  items: z.array(cartItemSchema).min(1),
})
export type CartSellerGroup = z.infer<typeof cartSellerGroupSchema>

export const cartSchema = z.object({
  id: cartIdSchema,
  userId: userIdSchema,
  sellerGroups: z.array(cartSellerGroupSchema).default([]),
  /** "Save for later" shelf — same item snapshot shape as an active line, just excluded from pricing/checkout until moved back. */
  savedItems: z.array(cartItemSchema).default([]),
  couponCode: z.string().optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
  /** Set once functions/src/notifications/sendAbandonedCartReminders.ts queues an `abandoned_cart` reminder for this cart, so it only ever fires once per period of inactivity. Cleared whenever the cart is next updated. */
  abandonedReminderSentAt: epochMsSchema.optional(),
})
export type Cart = z.infer<typeof cartSchema>

export const cartConverter = makeFirestoreConverter(cartSchema)
