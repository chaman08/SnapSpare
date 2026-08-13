import { z } from 'zod'
import { paymentMethodSchema } from '../enums'

/**
 * Phase 22 requirement 2's full event catalog — the single source of truth
 * for every GA4/Firebase Analytics event name this app ever sends. Adding an
 * event means adding it here first; apps/web/src/lib/analytics/track.ts's
 * `track()` helper only accepts names+payloads defined in this file, so a
 * typo or a hand-rolled ad-hoc event name is a compile error, not a silent
 * gap in a funnel report six months from now.
 */
export const analyticsEventNameSchema = z.enum([
  // Funnel top-of-funnel step — see schemas/analyticsFunnel.ts's funnelStepSchema.
  'search',
  // Standard GA4 ecommerce events (https://support.google.com/analytics/answer/9267735)
  'view_item_list',
  'view_item',
  'select_item',
  'add_to_cart',
  'remove_from_cart',
  'view_cart',
  'begin_checkout',
  'add_payment_info',
  'purchase',
  'refund',
  // SnapSpare-specific events (Phase 22 requirement 2)
  'vehicle_selected',
  'fitment_checked',
  'fitment_mismatch_shown',
  'tier_nudge_shown',
  'tier_nudge_accepted',
  'quantity_tier_reached',
  'gst_toggle_used',
  'rfq_created',
  'quote_accepted',
  'bulk_pad_used',
  'search_zero_results',
  'seller_compare_switched',
])
export type AnalyticsEventName = z.infer<typeof analyticsEventNameSchema>

/** GA4 Item object — a superset of fields GA4 recognizes; only the ones this catalog actually uses are typed. `price` is rupees (decimal), never paise — GA4 has no integer-currency concept, so the paise->rupee conversion happens once at the call site (see fromPaise in pricing/). */
export const analyticsItemSchema = z.object({
  item_id: z.string().min(1),
  item_name: z.string().min(1),
  item_category: z.string().optional(),
  item_category2: z.string().optional(),
  item_brand: z.string().optional(),
  item_list_id: z.string().optional(),
  item_list_name: z.string().optional(),
  affiliation: z.string().optional(),
  price: z.number().optional(),
  quantity: z.number().optional(),
  index: z.number().optional(),
})
export type AnalyticsItem = z.infer<typeof analyticsItemSchema>

const currencySchema = z.literal('INR')

const searchPayloadSchema = z.object({
  search_term: z.string(),
  resultCount: z.number().int().nonnegative(),
})

const viewItemListPayloadSchema = z.object({
  item_list_id: z.string().min(1),
  item_list_name: z.string().min(1),
  items: z.array(analyticsItemSchema).min(1),
})

const viewItemPayloadSchema = z.object({
  currency: currencySchema,
  value: z.number(),
  items: z.array(analyticsItemSchema).length(1),
})

const selectItemPayloadSchema = z.object({
  item_list_id: z.string().optional(),
  item_list_name: z.string().optional(),
  items: z.array(analyticsItemSchema).length(1),
})

const cartPayloadSchema = z.object({
  currency: currencySchema,
  value: z.number(),
  items: z.array(analyticsItemSchema).min(1),
})

const beginCheckoutPayloadSchema = z.object({
  currency: currencySchema,
  value: z.number(),
  coupon: z.string().optional(),
  items: z.array(analyticsItemSchema).min(1),
})

const addPaymentInfoPayloadSchema = z.object({
  currency: currencySchema,
  value: z.number(),
  payment_type: paymentMethodSchema,
  items: z.array(analyticsItemSchema).min(1),
})

const purchasePayloadSchema = z.object({
  transaction_id: z.string().min(1),
  currency: currencySchema,
  value: z.number(),
  tax: z.number().optional(),
  shipping: z.number().optional(),
  coupon: z.string().optional(),
  items: z.array(analyticsItemSchema).min(1),
})

const refundPayloadSchema = z.object({
  transaction_id: z.string().min(1),
  currency: currencySchema,
  value: z.number(),
  items: z.array(analyticsItemSchema).optional(),
})

const vehicleSelectedPayloadSchema = z.object({
  vehicleModelId: z.string().min(1),
  makeName: z.string().min(1),
  modelName: z.string().min(1),
  source: z.enum(['garage', 'quick_switch', 'reg_lookup', 'manual']),
})

const fitmentCheckedPayloadSchema = z.object({
  partId: z.string().min(1),
  vehicleModelId: z.string().min(1),
  result: z.enum(['fits', 'does_not_fit', 'unverified']),
})

const fitmentMismatchShownPayloadSchema = z.object({
  partId: z.string().min(1),
  vehicleModelId: z.string().min(1),
})

const tierNudgeShownPayloadSchema = z.object({
  listingId: z.string().min(1),
  currentQty: z.number().int().positive(),
  nextTierMinQty: z.number().int().positive(),
  savingsPaise: z.number().int().nonnegative(),
})

const tierNudgeAcceptedPayloadSchema = z.object({
  listingId: z.string().min(1),
  fromQty: z.number().int().positive(),
  toQty: z.number().int().positive(),
})

const quantityTierReachedPayloadSchema = z.object({
  listingId: z.string().min(1),
  tierMinQtyApplied: z.number().int().positive(),
})

const gstToggleUsedPayloadSchema = z.object({
  mode: z.enum(['inclusive', 'exclusive']),
})

const rfqCreatedPayloadSchema = z.object({
  rfqId: z.string().min(1),
  itemCount: z.number().int().positive(),
})

const quoteAcceptedPayloadSchema = z.object({
  rfqId: z.string().min(1),
  quoteId: z.string().min(1),
  sellerId: z.string().min(1),
})

const bulkPadUsedPayloadSchema = z.object({
  itemCount: z.number().int().positive(),
})

const searchZeroResultsPayloadSchema = z.object({
  query: z.string(),
  filtersApplied: z.array(z.string()).default([]),
})

const sellerCompareSwitchedPayloadSchema = z.object({
  partId: z.string().min(1),
  fromListingId: z.string().optional(),
  toListingId: z.string().min(1),
})

/** One schema per event name — see analyticsEventNameSchema above for the full list. Kept as a plain object (not z.discriminatedUnion) because payload shapes don't share a common tag field; AnalyticsEventPayloadMap below is what gives track() its per-name payload type. */
export const analyticsEventSchemas = {
  search: searchPayloadSchema,
  view_item_list: viewItemListPayloadSchema,
  view_item: viewItemPayloadSchema,
  select_item: selectItemPayloadSchema,
  add_to_cart: cartPayloadSchema,
  remove_from_cart: cartPayloadSchema,
  view_cart: cartPayloadSchema,
  begin_checkout: beginCheckoutPayloadSchema,
  add_payment_info: addPaymentInfoPayloadSchema,
  purchase: purchasePayloadSchema,
  refund: refundPayloadSchema,
  vehicle_selected: vehicleSelectedPayloadSchema,
  fitment_checked: fitmentCheckedPayloadSchema,
  fitment_mismatch_shown: fitmentMismatchShownPayloadSchema,
  tier_nudge_shown: tierNudgeShownPayloadSchema,
  tier_nudge_accepted: tierNudgeAcceptedPayloadSchema,
  quantity_tier_reached: quantityTierReachedPayloadSchema,
  gst_toggle_used: gstToggleUsedPayloadSchema,
  rfq_created: rfqCreatedPayloadSchema,
  quote_accepted: quoteAcceptedPayloadSchema,
  bulk_pad_used: bulkPadUsedPayloadSchema,
  search_zero_results: searchZeroResultsPayloadSchema,
  seller_compare_switched: sellerCompareSwitchedPayloadSchema,
} as const satisfies Record<AnalyticsEventName, z.ZodTypeAny>

export type AnalyticsEventPayloadMap = {
  [K in keyof typeof analyticsEventSchemas]: z.infer<(typeof analyticsEventSchemas)[K]>
}

/** The funnel step names, in funnel order — must match schemas/analyticsFunnel.ts's funnelStepSchema exactly (kept in sync manually; both are small, stable lists). Every one of these is also a full analytics event above, so a step fires both the funnel counter (logFunnelEvent) and the normal GA4/Firebase Analytics event in one track() call — see apps/web/src/lib/analytics/track.ts. */
export const FUNNEL_EVENT_NAMES = [
  'search',
  'view_item_list',
  'view_item',
  'add_to_cart',
  'view_cart',
  'begin_checkout',
  'add_payment_info',
  'purchase',
] as const
