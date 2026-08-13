import { brandAuthorizationSchema, type ListingGenuineBadge } from '@snapspare/shared'
import type { Firestore } from 'firebase-admin/firestore'

/**
 * Looks up whether `sellerId` holds a `verified` brand authorization that
 * covers `brand`/`categorySlug` — the single source of truth for the
 * "Genuine part" badge (design brief item 4: "Never award a badge without a
 * document"). Case-insensitive brand match; an authorization with no
 * `categorySlugs` covers every category for that brand. Shared by
 * persistListing.ts (badge computed at listing-save time) and
 * onBrandAuthorizationWrite.ts (recomputes existing listings when an
 * authorization is verified/revoked).
 */
export async function findVerifiedBrandAuthorization(
  db: Firestore,
  sellerId: string,
  brand: string | undefined,
  categorySlug: string | undefined,
): Promise<{ id: string; verifiedAt?: number } | undefined> {
  if (!brand) return undefined
  const normalizedBrand = brand.trim().toLowerCase()

  const snapshot = await db
    .collection('brandAuthorizations')
    .where('sellerId', '==', sellerId)
    .where('status', '==', 'verified')
    .get()

  for (const doc of snapshot.docs) {
    const parsed = brandAuthorizationSchema.safeParse({ id: doc.id, ...doc.data() })
    if (!parsed.success) continue
    const auth = parsed.data
    if (auth.brandName.trim().toLowerCase() !== normalizedBrand) continue
    if (auth.categorySlugs && auth.categorySlugs.length > 0 && (!categorySlug || !auth.categorySlugs.includes(categorySlug))) continue
    return { id: auth.id, verifiedAt: auth.verifiedAt }
  }
  return undefined
}

export function toGenuineBadge(auth: { id: string; verifiedAt?: number } | undefined): ListingGenuineBadge {
  if (!auth) return { verified: false }
  return { verified: true, verifiedAt: auth.verifiedAt, brandAuthorizationId: auth.id }
}
