import {
  type GroupPricing,
  type Listing,
  type ListingGenuineBadge,
  type ListingPricing,
  type SaveListingRequest,
  type SaveListingResult,
  catalogPartSchema,
  listingPricingSchema,
  listingSchema,
} from '@snapspare/shared'
import type { Firestore } from 'firebase-admin/firestore'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import type { ZodIssue } from 'zod'
import { findVerifiedBrandAuthorization, toGenuineBadge } from '../trust/genuineBadge.js'
import { stripUndefined } from '../util/stripUndefined.js'

/** Looks up the seller's "Genuine part" badge eligibility for `partId` at listing-save time — see functions/src/trust/genuineBadge.ts and onBrandAuthorizationWrite.ts (which recomputes this for listings saved before an authorization existed). */
async function computeGenuineBadge(db: Firestore, sellerId: string, partId: string): Promise<ListingGenuineBadge> {
  const partSnapshot = await db.collection('catalogParts').doc(partId).get()
  if (!partSnapshot.exists) return { verified: false }
  const part = catalogPartSchema.safeParse({ id: partSnapshot.id, ...partSnapshot.data() })
  if (!part.success) return { verified: false }
  const matched = await findVerifiedBrandAuthorization(db, sellerId, part.data.brand, part.data.categorySlug)
  return toGenuineBadge(matched)
}

export type ValidateListingResult = { success: true; data: Listing } | { success: false; issues: ZodIssue[] }

/**
 * Non-throwing sibling of `parseOrThrow` — the shared validation core both
 * that function and `parseBulkListingUpload.ts`'s per-row dry-run use.
 * Exported so bulk upload can validate a candidate listing without writing
 * anything or needing an HttpsError to catch.
 */
export function validateListing(candidate: unknown): ValidateListingResult {
  const parsed = listingSchema.safeParse(candidate)
  if (!parsed.success) return { success: false, issues: parsed.error.issues }

  if (parsed.data.groupPricing) {
    for (const [buyerType, tiers] of Object.entries(parsed.data.groupPricing)) {
      const groupParsed = listingPricingSchema.safeParse({
        moq: parsed.data.pricing.moq,
        stepQty: parsed.data.pricing.stepQty,
        tiers,
      })
      if (!groupParsed.success) {
        return {
          success: false,
          issues: groupParsed.error.issues.map((issue) => ({ ...issue, path: ['groupPricing', buyerType, ...issue.path] })),
        }
      }
    }
  }

  return { success: true, data: parsed.data }
}

export interface PersistListingParams {
  sellerId: string
  input: SaveListingRequest
}

function stripId(listing: Listing): Omit<Listing, 'id'> {
  const { id: _id, ...rest } = listing
  return stripUndefined(rest) as Omit<Listing, 'id'>
}

/** Throws an HttpsError carrying the first zod issue's human-readable message plus every issue in `details`, so a client that skipped/missed live validation still gets an actionable error instead of a generic 400. */
function parseOrThrow(candidate: unknown): Listing {
  const result = validateListing(candidate)
  if (!result.success) {
    throw new HttpsError('invalid-argument', result.issues[0]?.message ?? 'invalid_listing', { issues: result.issues })
  }
  return result.data
}

async function fetchOwnedListing(db: Firestore, sellerId: string, listingId: string): Promise<Listing> {
  const snapshot = await db.collection('listings').doc(listingId).get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'listing_not_found')
  const listing = listingSchema.parse({ id: snapshot.id, ...snapshot.data() })
  if (listing.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_listing')
  return listing
}

/**
 * Single source of truth for writing a listing: re-validates the full
 * `listingSchema` — including `listingPricingSchema`'s deep tier-ladder
 * invariants (contiguous ranges, strictly-descending price, moq % stepQty)
 * — server-side via the Admin SDK, which bypasses firestore.rules entirely.
 * That's necessary, not redundant: `listingFieldsValid()` in firestore.rules
 * can only check shallow per-field shape (rules can't practically re-run a
 * cross-array-element refinement), so this function is the actual
 * enforcement point for the invariants that make the pricing ladder
 * meaningful. Reused by `saveListing.ts` (single create/update),
 * `reviewPartRequest.ts`'s approve-path stub listing, and the bulk upload
 * commit path.
 */
export async function persistListing({ sellerId, input }: PersistListingParams): Promise<SaveListingResult> {
  const db = getFirestore()
  const now = Date.now()
  const listingsRef = db.collection('listings')

  if (input.id) {
    const existing = await fetchOwnedListing(db, sellerId, input.id)
    const genuineBadge = await computeGenuineBadge(db, sellerId, existing.partId)

    const candidate = parseOrThrow({
      ...existing,
      ...input,
      id: existing.id,
      sellerId: existing.sellerId,
      partId: existing.partId,
      reservedStock: existing.reservedStock,
      viewCount: existing.viewCount,
      status: existing.status,
      pausedByHolidayMode: existing.pausedByHolidayMode,
      genuineBadge,
      createdAt: existing.createdAt,
      updatedAt: now,
    })

    await listingsRef.doc(existing.id).set(stripId(candidate))
    return { id: candidate.id }
  }

  const partSnapshot = await db.collection('catalogParts').doc(input.partId).get()
  if (!partSnapshot.exists) {
    throw new HttpsError('not-found', 'catalog_part_not_found')
  }

  const newRef = listingsRef.doc()
  const genuineBadge = await computeGenuineBadge(db, sellerId, input.partId)
  const candidate = parseOrThrow({
    ...input,
    id: newRef.id,
    sellerId,
    reservedStock: 0,
    viewCount: 0,
    status: 'draft',
    genuineBadge,
    createdAt: now,
    updatedAt: now,
  })

  await newRef.set(stripId(candidate))
  return { id: candidate.id }
}

export interface ApplyPricingPatchParams {
  sellerId: string
  listingId: string
  pricing: ListingPricing
  /** Omitted means "leave the listing's existing groupPricing untouched"; present (even `{}`) replaces it entirely — used by both pricingTemplates.ts (a template with no group overrides shouldn't clear a listing's existing ones) and bulk price-change (which only ever touches the default ladder). */
  groupPricing?: GroupPricing
}

/**
 * Overwrites just a listing's pricing (and optionally groupPricing),
 * re-validated exactly like any other write — the shared primitive behind
 * `applyPricingTemplate` (pricingTemplates.ts) and bulk price-change
 * (bulkPriceChange.ts), both of which need to touch pricing on many
 * listings without re-supplying every other seller-authorable field the
 * way a full `persistListing` call would require.
 */
export async function applyPricingPatch({ sellerId, listingId, pricing, groupPricing }: ApplyPricingPatchParams): Promise<void> {
  const db = getFirestore()
  const existing = await fetchOwnedListing(db, sellerId, listingId)

  const candidate = parseOrThrow({
    ...existing,
    pricing,
    groupPricing: groupPricing ?? existing.groupPricing,
    updatedAt: Date.now(),
  })

  await db.collection('listings').doc(listingId).set(stripId(candidate))
}
