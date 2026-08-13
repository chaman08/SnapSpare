import { z } from 'zod'
import { notificationChannelSchema } from './notification'
import { sellerTrustTierSchema } from './seller'
import { makeFirestoreConverter } from '../firestore/converter'
import { sellerIdSchema, userIdSchema } from '../ids'
import { gstinSchema } from '../validators/indian'
import { epochMsSchema, stateCodeSchema } from './common'

/**
 * Phase 24 (launch readiness): Consumer Protection (E-Commerce) Rules, 2020,
 * Rule 5(4) requires the seller's legal name and principal geographic
 * address on every product/store page. Deliberately just the public
 * disclosure subset of `sellerApplicationAddressSchema` (no contact
 * name/phone — that's the pickup-address contact, not a legal disclosure
 * field) so nothing sensitive leaks through this already-public doc.
 */
export const sellerDisclosureAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  stateCode: stateCodeSchema,
  pincode: z.string().min(1),
})
export type SellerDisclosureAddress = z.infer<typeof sellerDisclosureAddressSchema>

/**
 * Seller-editable settings, kept in a separate doc/subcollection from
 * `sellers/{sellerId}` on purpose — that top-level doc holds
 * authorization/money-sensitive fields (status, bankAccount,
 * commissionRatePercent, gstin/pan) that stay Cloud-Function-only, while
 * everything here is safe for the owner (or a staff member with
 * `manage_listings`) to write directly, rules-guarded. `holidayMode` is the
 * one exception within this doc: flipping it has to bulk-touch listings
 * atomically, so it's callable-only (setHolidayMode.ts) even though it lives
 * alongside the directly-writable fields — see firestore.rules'
 * `unchangedHolidayModeFields()`.
 */
export const sellerHolidayModeSchema = z.object({
  active: z.boolean().default(false),
  returnDate: epochMsSchema.optional(),
  reason: z.string().max(200).optional(),
  setAt: epochMsSchema.optional(),
})
export type SellerHolidayMode = z.infer<typeof sellerHolidayModeSchema>

export const sellerSlaPreferencesSchema = z.object({
  acceptWithinHours: z.number().int().positive().default(24),
  packWithinHours: z.number().int().positive().default(24),
})
export type SellerSlaPreferences = z.infer<typeof sellerSlaPreferencesSchema>

export const sellerNotificationPreferencesSchema = z.object({
  channels: z.array(notificationChannelSchema).default(['push', 'whatsapp']),
})
export type SellerNotificationPreferences = z.infer<typeof sellerNotificationPreferencesSchema>

/** Public store-page handle — lowercase letters, digits, hyphens; 3-50 chars, can't start/end with a hyphen. */
export const storeSlugSchema = z
  .string()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/, 'Invalid store handle — use lowercase letters, numbers and hyphens')

export const sellerSettingsSchema = z.object({
  id: sellerIdSchema,
  storeName: z.string().min(1).optional(),
  storeDescription: z.string().max(2000).optional(),
  storeBannerStoragePath: z.string().optional(),
  /** Set only via setStoreSlug.ts (atomic claim against storeSlugReservations) — never a direct write, same treatment as holidayMode below. */
  storeSlug: storeSlugSchema.optional(),
  /**
   * Denormalized from `sellers/{sellerId}` (requirement 7's public store
   * page) — this `settings/general` doc is the only seller-scoped doc
   * that's publicly readable, so these copies exist rather than widening
   * the `sellers/{sellerId}` doc's read rule, which also holds
   * gstin/pan/bankAccount. Kept in sync at the one place `businessName`
   * is ever set (reviewSellerApplication.ts's approval batch — there's no
   * post-onboarding "edit business name" flow to also cover) and would be
   * re-synced anywhere `ratingAvg`/`ratingCount` are aggregated, if/when
   * that rollup exists — today they stay at their seller-doc defaults (0).
   */
  businessName: z.string().min(1).optional(),
  /**
   * Phase 24: same denormalization rationale as `businessName` above, added
   * for the Consumer Protection (E-Commerce) Rules Rule 5(4) disclosure —
   * seller legal name/address/GSTIN shown on every product page and the
   * store page. Kept in sync at the same one place `businessName` is
   * (`reviewSellerApplication.ts`'s approval batch) — there's still no
   * post-onboarding "edit registered address" flow to also cover, so a
   * seller whose registered address changes after approval needs a manual
   * admin-side correction until one exists (see README's Phase 24 notes).
   */
  legalName: z.string().min(1).optional(),
  registeredAddress: sellerDisclosureAddressSchema.optional(),
  gstin: gstinSchema.optional(),
  ratingAvg: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().nonnegative().default(0),
  /** Phase 17: mirrored alongside ratingAvg/ratingCount by onReviewWrite.ts. */
  ratingBayesian: z.number().min(0).max(5).default(0),
  /** Phase 17: mirrored by computeSellerTrustScores.ts — only the tier (not the full private breakdown) is public, for the buyer-facing SellerTrustBadge. */
  trustTier: sellerTrustTierSchema.optional(),
  holidayMode: sellerHolidayModeSchema.default({ active: false }),
  slaPreferences: sellerSlaPreferencesSchema.default({ acceptWithinHours: 24, packWithinHours: 24 }),
  notificationPreferences: sellerNotificationPreferencesSchema.default({ channels: ['push', 'whatsapp'] }),
  updatedBy: userIdSchema.optional(),
  updatedAt: epochMsSchema,
})
export type SellerSettings = z.infer<typeof sellerSettingsSchema>

export const sellerSettingsConverter = makeFirestoreConverter(sellerSettingsSchema)

export const setStoreSlugRequestSchema = z.object({
  slug: storeSlugSchema,
})
export type SetStoreSlugRequest = z.infer<typeof setStoreSlugRequestSchema>

export const setStoreSlugResultSchema = z.object({
  slug: storeSlugSchema,
})
export type SetStoreSlugResult = z.infer<typeof setStoreSlugResultSchema>

/** One doc per claimed handle (id = the slug itself) — the atomic-claim lock setStoreSlug.ts transacts against, and the public /store/:sellerSlug route's slug-to-sellerId lookup. */
export const storeSlugReservationSchema = z.object({
  id: storeSlugSchema,
  sellerId: sellerIdSchema,
  claimedAt: epochMsSchema,
})
export type StoreSlugReservation = z.infer<typeof storeSlugReservationSchema>
export const storeSlugReservationConverter = makeFirestoreConverter(storeSlugReservationSchema)

export const setHolidayModeRequestSchema = z.object({
  active: z.boolean(),
  returnDate: epochMsSchema.optional(),
  reason: z.string().max(200).optional(),
})
export type SetHolidayModeRequest = z.infer<typeof setHolidayModeRequestSchema>

export const setHolidayModeResultSchema = z.object({
  listingsAffected: z.number().int().nonnegative(),
})
export type SetHolidayModeResult = z.infer<typeof setHolidayModeResultSchema>
