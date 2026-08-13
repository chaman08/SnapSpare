import type {
  BulkOrderMatchedRow,
  BulkOrderUnmatchedRow,
  Listing,
} from '@snapspare/shared'
import {
  catalogPartSchema,
  listingSchema,
  resolveBulkOrderRequestSchema,
  resolveTiersForBuyer,
  sellerSchema,
  tierForQty,
  type ResolveBulkOrderResult,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

const MAX_ROWS = 200

/** The qty a listing would actually be ordered at for this row: snapped up to MOQ, then onto the stepQty grid, then capped at stock — never above what's actually purchasable. */
function resolvableQty(listing: Listing, requestedQty: number): number | null {
  if (listing.stockQty <= 0) return null
  const { moq, stepQty } = listing.pricing
  const maxOrderable = Math.min(listing.stockQty, listing.maxOrderQty ?? listing.stockQty)
  if (maxOrderable < moq) return null

  let qty = Math.max(requestedQty, moq)
  const steps = Math.round((qty - moq) / stepQty)
  qty = moq + steps * stepQty
  if (qty > maxOrderable) {
    const cappedSteps = Math.floor((maxOrderable - moq) / stepQty)
    qty = moq + Math.max(0, cappedSteps) * stepQty
  }
  return qty >= moq ? qty : null
}

async function findMatchingListings(query: string): Promise<Listing[]> {
  const db = getFirestore()
  const normalized = query.trim()
  if (!normalized) return []

  const [bySku, byPartNumber, byOem, byCrossRef] = await Promise.all([
    db.collection('listings').where('sku', '==', normalized).where('status', '==', 'active').limit(20).get(),
    db.collection('catalogParts').where('partNumber', '==', normalized).limit(5).get(),
    db.collection('catalogParts').where('oemNumbers', 'array-contains', normalized).limit(5).get(),
    db.collection('catalogParts').where('crossRefNumbers', 'array-contains', normalized).limit(5).get(),
  ])

  const listings: Listing[] = []
  for (const doc of bySku.docs) {
    const parsed = listingSchema.safeParse({ id: doc.id, ...doc.data() })
    if (parsed.success) listings.push(parsed.data)
  }

  const partIds = new Set<string>()
  for (const snapshot of [byPartNumber, byOem, byCrossRef]) {
    for (const doc of snapshot.docs) {
      const parsed = catalogPartSchema.safeParse({ id: doc.id, ...doc.data() })
      if (parsed.success) partIds.add(parsed.data.id)
    }
  }

  if (partIds.size > 0) {
    const partIdList = Array.from(partIds).slice(0, 30)
    const listingSnapshot = await db
      .collection('listings')
      .where('partId', 'in', partIdList)
      .where('status', '==', 'active')
      .get()
    for (const doc of listingSnapshot.docs) {
      const parsed = listingSchema.safeParse({ id: doc.id, ...doc.data() })
      if (parsed.success && !listings.some((existing) => existing.id === parsed.data.id)) {
        listings.push(parsed.data)
      }
    }
  }

  return listings
}

/**
 * Bulk order pad resolution (design spec item 10): resolves each pasted/CSV
 * row's part number/SKU to the cheapest active listing at the requested
 * quantity, reporting unmatched rows separately rather than silently
 * dropping them. Rows that fail to parse client-side never reach here — see
 * `features/cart/lib/parseBulkOrderInput.ts` — so every unmatched reason
 * returned by this function is about catalog resolution, not row syntax.
 */
export const resolveBulkOrder = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<ResolveBulkOrderResult> => {
    const parsed = resolveBulkOrderRequestSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'A valid list of rows is required')
    }
    if (parsed.data.rows.length > MAX_ROWS) {
      throw new HttpsError('invalid-argument', `A maximum of ${MAX_ROWS} rows can be resolved at once`)
    }

    const matched: BulkOrderMatchedRow[] = []
    const unmatched: BulkOrderUnmatchedRow[] = []
    const sellerNameCache = new Map<string, string>()

    for (const row of parsed.data.rows) {
      const candidates = await findMatchingListings(row.query)
      if (candidates.length === 0) {
        unmatched.push({ raw: row.raw, query: row.query, qty: row.qty, reason: 'not_found' })
        continue
      }

      let best: { listing: Listing; qty: number; unitPricePaise: number; tierMinQty: number } | undefined
      for (const listing of candidates) {
        const qty = resolvableQty(listing, row.qty)
        if (qty === null) continue
        const tier = tierForQty(resolveTiersForBuyer(listing, undefined), qty)
        if (!best || tier.unitPricePaise < best.unitPricePaise) {
          best = { listing, qty, unitPricePaise: tier.unitPricePaise, tierMinQty: tier.minQty }
        }
      }

      if (!best) {
        unmatched.push({ raw: row.raw, query: row.query, qty: row.qty, reason: 'out_of_stock' })
        continue
      }

      let sellerName = sellerNameCache.get(best.listing.sellerId)
      if (sellerName === undefined) {
        const sellerSnapshot = await getFirestore().collection('sellers').doc(best.listing.sellerId).get()
        const sellerParsed = sellerSnapshot.exists
          ? sellerSchema.safeParse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })
          : undefined
        sellerName = sellerParsed?.success ? sellerParsed.data.businessName : ''
        sellerNameCache.set(best.listing.sellerId, sellerName)
      }

      matched.push({
        raw: row.raw,
        query: row.query,
        requestedQty: row.qty,
        resolvedQty: best.qty,
        listingId: best.listing.id,
        partId: best.listing.partId,
        sellerId: best.listing.sellerId,
        sellerName,
        title: best.listing.title,
        unitPricePaise: best.unitPricePaise,
        tierMinQtyApplied: best.tierMinQty,
      })
    }

    return { matched, unmatched }
  },
)
