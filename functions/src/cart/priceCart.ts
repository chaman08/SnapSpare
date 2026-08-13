import type {
  BuyerType,
  CartLineWarning,
  CatalogPart,
  Coupon,
  CouponApplicationResult,
  IndianStateCode,
  Listing,
  PincodeMaster,
  PriceCartRequest,
  PriceCartResult,
  PricedCartLine,
  PricedSellerGroup,
  Seller,
} from '@snapspare/shared'
import {
  applyPercent,
  catalogPartSchema,
  computeChargeableWeightGrams,
  couponSchema,
  DEFAULT_LISTING_WEIGHT_GRAMS,
  estimateSellerShipping,
  isInterState,
  isValidStateCode,
  listingSchema,
  nextTier,
  pincodeMasterSchema,
  priceCartRequestSchema,
  resolveShippingZone,
  resolveTiersForBuyer,
  sellerSchema,
  splitProportionally,
  tierForQty,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getShippingConfig } from '../shipping/shippingConfig.js'

const MAX_CROSS_SELLER_LOOKUPS = 25

interface ResolvedLine {
  listing: Listing
  requestedQty: number
  resolvedQty: number
  unitPricePaise: number
  tierMinQtyApplied: number
  warnings: CartLineWarning[]
  snapshotUnitPricePaise?: number
  snapshotTierMinQtyApplied?: number
}

/** Snaps `qty` down onto the [moq, stepQty] grid used by QuantityStepper, then caps it at `stockQty`/`maxOrderQty`. Mirrors the client's own snapping so a value the client considered valid never gets silently re-snapped to something surprising here. Exported for priceCart.test.ts's direct unit coverage of the MOQ/step-rounding rules. */
export function resolveQty(listing: Listing, requestedQty: number, warnings: CartLineWarning[]): number {
  const { moq, stepQty } = listing.pricing
  const maxOrderable = Math.min(listing.stockQty, listing.maxOrderQty ?? listing.stockQty)

  if (listing.stockQty <= 0) {
    warnings.push({ code: 'out_of_stock', requestedQty })
    return 0
  }

  let qty = requestedQty
  if (qty < moq) {
    warnings.push({ code: 'qty_adjusted_to_moq', requestedQty, adjustedQty: moq })
    qty = moq
  }

  const steps = Math.round((qty - moq) / stepQty)
  const snapped = moq + steps * stepQty
  if (snapped !== qty) {
    warnings.push({ code: 'qty_adjusted_to_step', requestedQty: qty, adjustedQty: snapped })
    qty = snapped
  }

  if (qty > maxOrderable) {
    // maxOrderable can itself be below moq (stock has dropped under the
    // listing's own minimum order quantity) — that's not steppable down to
    // anything valid, so it's out of stock, full stop. Checking this before
    // computing cappedSteps matters: clamping a negative cappedSteps to 0
    // would otherwise silently produce `capped === moq`, which is >= moq and
    // so would slip past a `capped < moq` check even though moq itself
    // isn't actually orderable.
    if (maxOrderable < moq) {
      warnings.push({ code: 'out_of_stock', requestedQty: qty })
      return 0
    }
    const cappedSteps = Math.floor((maxOrderable - moq) / stepQty)
    const capped = moq + cappedSteps * stepQty
    warnings.push({ code: 'qty_capped_to_stock', requestedQty: qty, adjustedQty: capped })
    qty = capped
  }

  return qty
}

async function fetchByIds<T>(
  collection: string,
  ids: string[],
  parse: (id: string, data: Record<string, unknown>) => T,
): Promise<Map<string, T>> {
  const db = getFirestore()
  const uniqueIds = Array.from(new Set(ids))
  const snapshots = await Promise.all(uniqueIds.map((id) => db.collection(collection).doc(id).get()))
  const result = new Map<string, T>()
  snapshots.forEach((snapshot, index) => {
    if (snapshot.exists) {
      result.set(uniqueIds[index] as string, parse(snapshot.id, snapshot.data() as Record<string, unknown>))
    }
  })
  return result
}

/** Cheapest other active listing for the same part, at the same resolved qty/buyer group, strictly cheaper than `currentUnitPricePaise` — the honest cross-seller nudge (design spec item 5). Deliberately best-effort: a query failure here never blocks pricing the buyer's own cart. */
async function findCheaperElsewhere(
  partId: string,
  excludeListingId: string,
  qty: number,
  buyerType: BuyerType | undefined,
  currentUnitPricePaise: number,
  sellerNameById: Map<string, string>,
): Promise<PricedCartLine['cheaperElsewhere']> {
  try {
    const snapshot = await getFirestore()
      .collection('listings')
      .where('partId', '==', partId)
      .where('status', '==', 'active')
      .limit(10)
      .get()

    let best: { listingId: string; sellerId: string; unitPricePaise: number } | undefined
    for (const doc of snapshot.docs) {
      if (doc.id === excludeListingId) continue
      const candidate = listingSchema.safeParse({ id: doc.id, ...doc.data() })
      if (!candidate.success) continue
      const candidateTier = tierForQty(resolveTiersForBuyer(candidate.data, buyerType), qty)
      if (candidateTier.unitPricePaise < currentUnitPricePaise && (!best || candidateTier.unitPricePaise < best.unitPricePaise)) {
        best = { listingId: doc.id, sellerId: candidate.data.sellerId, unitPricePaise: candidateTier.unitPricePaise }
      }
    }

    if (!best) return undefined
    return {
      listingId: best.listingId,
      sellerId: best.sellerId,
      sellerName: sellerNameById.get(best.sellerId) ?? '',
      unitPricePaise: best.unitPricePaise,
    }
  } catch {
    return undefined
  }
}

/**
 * The pure rule-application half of coupon resolution: given an
 * already-fetched, already-parsed `Coupon` doc, decides whether it applies
 * to this cart and how the discount splits across lines. Split out from
 * `resolveCoupon` below (which only adds the Firestore fetch + not-found
 * handling) so this — the actual business logic priceCart.test.ts covers —
 * has no Firestore dependency and no `couponCode` in scope of "not found".
 */
export function applyCouponRules(
  coupon: Coupon,
  subtotalPaise: number,
  lines: Array<{ sellerId: string; listing: Listing; catalogPart?: CatalogPart; lineSubtotalPaise: number }>,
): { result: CouponApplicationResult; discountBySellerAndListing: Map<string, number> } {
  const discountBySellerAndListing = new Map<string, number>()
  const couponCode = coupon.code
  const now = Date.now()

  if (coupon.status !== 'active') {
    return { result: { status: 'rejected', code: couponCode, reason: 'inactive' }, discountBySellerAndListing }
  }
  if (now < coupon.validFrom) {
    return { result: { status: 'rejected', code: couponCode, reason: 'not_yet_valid' }, discountBySellerAndListing }
  }
  if (now > coupon.validUntil) {
    return { result: { status: 'rejected', code: couponCode, reason: 'expired' }, discountBySellerAndListing }
  }
  if (coupon.usageLimitTotal !== undefined && coupon.usedCount >= coupon.usageLimitTotal) {
    return { result: { status: 'rejected', code: couponCode, reason: 'usage_limit_reached' }, discountBySellerAndListing }
  }
  if (coupon.minOrderValuePaise !== undefined && subtotalPaise < coupon.minOrderValuePaise) {
    return {
      result: {
        status: 'rejected',
        code: couponCode,
        reason: 'min_order_not_met',
        minOrderValuePaise: coupon.minOrderValuePaise,
      },
      discountBySellerAndListing,
    }
  }

  const eligibleLines = lines.filter((line) => {
    if (coupon.applicableSellerIds && !coupon.applicableSellerIds.includes(line.sellerId)) return false
    if (coupon.applicableCategorySlugs && !line.catalogPart) return false
    if (coupon.applicableCategorySlugs && line.catalogPart && !coupon.applicableCategorySlugs.includes(line.catalogPart.categorySlug)) {
      return false
    }
    return line.lineSubtotalPaise > 0
  })

  const eligibleSubtotalPaise = eligibleLines.reduce((sum, line) => sum + line.lineSubtotalPaise, 0)
  if (eligibleLines.length === 0 || eligibleSubtotalPaise <= 0) {
    return { result: { status: 'rejected', code: couponCode, reason: 'not_applicable_to_cart' }, discountBySellerAndListing }
  }

  const rawDiscountPaise =
    coupon.discountType === 'percent'
      ? applyPercent(eligibleSubtotalPaise, coupon.discountPercent)
      : coupon.discountAmountPaise
  const cappedDiscountPaise =
    coupon.discountType === 'percent' && coupon.maxDiscountPaise !== undefined
      ? Math.min(rawDiscountPaise, coupon.maxDiscountPaise)
      : rawDiscountPaise
  const discountPaise = Math.min(cappedDiscountPaise, eligibleSubtotalPaise)

  const shares = splitProportionally(discountPaise, eligibleLines.map((line) => line.lineSubtotalPaise))
  eligibleLines.forEach((line, index) => {
    discountBySellerAndListing.set(`${line.sellerId}:${line.listing.id}`, shares[index] ?? 0)
  })

  return {
    result: { status: 'applied', code: couponCode, discountPaise },
    discountBySellerAndListing,
  }
}

async function resolveCoupon(
  couponCode: string | undefined,
  subtotalPaise: number,
  lines: Array<{ sellerId: string; listing: Listing; catalogPart?: CatalogPart; lineSubtotalPaise: number }>,
): Promise<{ result: CouponApplicationResult | undefined; discountBySellerAndListing: Map<string, number> }> {
  if (!couponCode) return { result: undefined, discountBySellerAndListing: new Map() }

  const snapshot = await getFirestore().collection('coupons').where('code', '==', couponCode).limit(1).get()
  if (snapshot.empty) {
    return { result: { status: 'rejected', code: couponCode, reason: 'not_found' }, discountBySellerAndListing: new Map() }
  }

  const parsed = couponSchema.safeParse({ id: snapshot.docs[0]?.id, ...snapshot.docs[0]?.data() })
  if (!parsed.success) {
    return { result: { status: 'rejected', code: couponCode, reason: 'not_found' }, discountBySellerAndListing: new Map() }
  }

  return applyCouponRules(parsed.data, subtotalPaise, lines)
}

/**
 * The single source of truth for cart money (design spec item 2). Re-fetches
 * every listing fresh, resolves quantities/tiers/coupon/tax/shipping
 * server-side, and returns a fully itemised breakdown the client only ever
 * renders — it never recomputes a payable amount itself. Extracted as a
 * plain function (rather than living inline in the `onCall` handler below)
 * so createOrder can re-run the exact same pricing server-side at order
 * placement time instead of trusting whatever the client last saw.
 */
export async function computePriceCart(request: PriceCartRequest): Promise<PriceCartResult> {
  const { items, couponCode, pincode, buyerType } = request

  const listingById = await fetchByIds('listings', items.map((item) => item.listingId), (id, data) =>
    listingSchema.parse({ id, ...data }),
  )

  const unavailableListingIds: string[] = []
  const resolvedLines: ResolvedLine[] = []

  for (const item of items) {
    const listing = listingById.get(item.listingId)
    if (!listing || listing.status !== 'active') {
      unavailableListingIds.push(item.listingId)
      continue
    }

    const warnings: CartLineWarning[] = []
    const resolvedQty = resolveQty(listing, item.qty, warnings)
    const tiers = resolveTiersForBuyer(listing, buyerType)
    const activeTier = tierForQty(tiers, resolvedQty > 0 ? resolvedQty : listing.pricing.moq)

    if (item.snapshotUnitPricePaise !== undefined && item.snapshotUnitPricePaise !== activeTier.unitPricePaise) {
      warnings.push({
        code: 'price_changed',
        previousUnitPricePaise: item.snapshotUnitPricePaise,
        newUnitPricePaise: activeTier.unitPricePaise,
      })
    }
    if (item.snapshotTierMinQtyApplied !== undefined && item.snapshotTierMinQtyApplied !== activeTier.minQty) {
      warnings.push({
        code: activeTier.minQty < item.snapshotTierMinQtyApplied ? 'tier_upgraded' : 'tier_downgraded',
      })
    }

    resolvedLines.push({
      listing,
      requestedQty: item.qty,
      resolvedQty,
      unitPricePaise: activeTier.unitPricePaise,
      tierMinQtyApplied: activeTier.minQty,
      warnings,
      snapshotUnitPricePaise: item.snapshotUnitPricePaise,
      snapshotTierMinQtyApplied: item.snapshotTierMinQtyApplied,
    })
  }

  const sellerIds = Array.from(new Set(resolvedLines.map((line) => line.listing.sellerId)))
  const [sellerById, shippingConfig] = await Promise.all([
    fetchByIds('sellers', sellerIds, (id, data) => sellerSchema.parse({ id, ...data })),
    getShippingConfig(),
  ])

  const partIds = Array.from(new Set(resolvedLines.map((line) => line.listing.partId)))
  const catalogPartById = couponCode
    ? await fetchByIds('catalogParts', partIds, (id, data) => catalogPartSchema.parse({ id, ...data }))
    : new Map<string, CatalogPart>()

  let buyerStateCode: IndianStateCode | undefined
  if (pincode) {
    const pincodeSnapshot = await getFirestore().collection('pincodes').doc(pincode).get()
    if (pincodeSnapshot.exists) {
      const record: PincodeMaster = pincodeMasterSchema.parse({ id: pincodeSnapshot.id, ...pincodeSnapshot.data() })
      if (isValidStateCode(record.stateCode)) buyerStateCode = record.stateCode
    }
  }

  const cartSubtotalPaise = resolvedLines.reduce((sum, line) => sum + line.unitPricePaise * line.resolvedQty, 0)

  const { result: couponResult, discountBySellerAndListing } = await resolveCoupon(
    couponCode,
    cartSubtotalPaise,
    resolvedLines.map((line) => ({
      sellerId: line.listing.sellerId,
      listing: line.listing,
      catalogPart: catalogPartById.get(line.listing.partId),
      lineSubtotalPaise: line.unitPricePaise * line.resolvedQty,
    })),
  )

  const sellerNameById = new Map(Array.from(sellerById.entries()).map(([id, seller]) => [id, seller.businessName]))
  const linesBySeller = new Map<string, ResolvedLine[]>()
  for (const line of resolvedLines) {
    const bucket = linesBySeller.get(line.listing.sellerId) ?? []
    bucket.push(line)
    linesBySeller.set(line.listing.sellerId, bucket)
  }

  const crossSellerBudget = { remaining: MAX_CROSS_SELLER_LOOKUPS }

  const sellerGroups: PricedSellerGroup[] = await Promise.all(
    Array.from(linesBySeller.entries()).map(async ([sellerId, lines]) => {
      const seller: Seller | undefined = sellerById.get(sellerId)

      const items: PricedCartLine[] = await Promise.all(
        lines.map(async (line) => {
          const lineSubtotalPaise = line.unitPricePaise * line.resolvedQty
          const lineDiscountPaise = discountBySellerAndListing.get(`${sellerId}:${line.listing.id}`) ?? 0
          const taxableValuePaise = lineSubtotalPaise - lineDiscountPaise
          // A composition-scheme seller (schemas/seller.ts's gstComposition)
          // cannot collect GST from buyers — they pay their composition tax
          // out of pocket to the government and issue a Bill of Supply, not
          // a Tax Invoice (see functions/src/tax/invoicePdf.ts). The item
          // still records its catalog gstRatePercent for reference; only the
          // collected tax amount is zeroed.
          const lineTaxPaise = seller?.gstComposition ? 0 : applyPercent(taxableValuePaise, line.listing.gstRatePercent)
          const lineTotalPaise = taxableValuePaise + lineTaxPaise

          const upcoming = line.resolvedQty > 0 ? nextTier(resolveTiersForBuyer(line.listing, buyerType), line.resolvedQty) : undefined
          const canReachNextTier =
            upcoming !== undefined &&
            upcoming.minQty <= line.listing.stockQty &&
            upcoming.minQty <= (line.listing.maxOrderQty ?? line.listing.stockQty)

          let cheaperElsewhere: PricedCartLine['cheaperElsewhere']
          if (line.resolvedQty > 0 && crossSellerBudget.remaining > 0) {
            crossSellerBudget.remaining -= 1
            cheaperElsewhere = await findCheaperElsewhere(
              line.listing.partId,
              line.listing.id,
              line.resolvedQty,
              buyerType,
              line.unitPricePaise,
              sellerNameById,
            )
          }

          return {
            listingId: line.listing.id,
            partId: line.listing.partId,
            sellerId,
            sku: line.listing.sku,
            title: line.listing.title,
            imageUrl: line.listing.images[0],
            qty: line.resolvedQty,
            unitPricePaise: line.unitPricePaise,
            tierMinQtyApplied: line.tierMinQtyApplied,
            hsnCode: line.listing.hsnCode,
            gstRatePercent: line.listing.gstRatePercent,
            lineSubtotalPaise,
            lineDiscountPaise,
            lineTaxPaise,
            lineTotalPaise,
            tierNudge:
              upcoming && canReachNextTier
                ? {
                    qtyToNextTier: upcoming.minQty - line.resolvedQty,
                    nextTierMinQty: upcoming.minQty,
                    nextTierUnitPricePaise: upcoming.unitPricePaise,
                    estimatedSavingsPaise: (line.unitPricePaise - upcoming.unitPricePaise) * upcoming.minQty,
                  }
                : undefined,
            cheaperElsewhere,
            warnings: line.warnings,
          }
        }),
      )

      const subtotalPaise = items.reduce((sum, item) => sum + item.lineSubtotalPaise, 0)
      const discountPaise = items.reduce((sum, item) => sum + item.lineDiscountPaise, 0)
      const taxableValuePaise = items.reduce((sum, item) => sum + item.lineSubtotalPaise - item.lineDiscountPaise, 0)

      const sellerStateCode = seller?.gstin.slice(0, 2) as IndianStateCode | undefined
      const interState = Boolean(sellerStateCode && buyerStateCode && isInterState(sellerStateCode, buyerStateCode))

      let cgstPaise = 0
      let sgstPaise = 0
      let igstPaise = 0
      for (const item of items) {
        if (interState) {
          igstPaise += item.lineTaxPaise
        } else {
          const [cgstShare, sgstShare] = splitProportionally(item.lineTaxPaise, [1, 1])
          cgstPaise += cgstShare ?? 0
          sgstPaise += sgstShare ?? 0
        }
      }
      const taxPaise = cgstPaise + sgstPaise + igstPaise

      const hasOversizedItem = lines.some((line) => line.listing.isOversized)
      const freeShippingThresholdPaise = seller?.freeShippingThresholdPaise ?? shippingConfig.freeShippingThresholdPaise

      let shippingPaise = 0
      let shippingZone: PricedSellerGroup['shippingZone']
      let etaDaysMin: number | undefined
      let etaDaysMax: number | undefined
      let viaSurfaceTransport = false
      if (sellerStateCode && buyerStateCode) {
        const totalWeightGrams = lines.reduce(
          (sum, line) =>
            sum +
            line.resolvedQty *
              computeChargeableWeightGrams(
                line.listing.weightGrams ?? DEFAULT_LISTING_WEIGHT_GRAMS,
                line.listing.dimensionsCm,
                shippingConfig.volumetricDivisorCm3PerKg,
              ),
          0,
        )
        const estimate = estimateSellerShipping(
          resolveShippingZone(sellerStateCode, buyerStateCode),
          totalWeightGrams,
          taxableValuePaise,
          shippingConfig,
          { isOversized: hasOversizedItem, freeShippingThresholdOverridePaise: freeShippingThresholdPaise },
        )
        shippingPaise = estimate.shippingPaise
        shippingZone = estimate.zone
        etaDaysMin = estimate.etaDaysMin
        etaDaysMax = estimate.etaDaysMax
        viaSurfaceTransport = estimate.viaSurfaceTransport
      }

      const freeShippingRemainingPaise =
        shippingPaise > 0 ? Math.max(0, freeShippingThresholdPaise - taxableValuePaise) : 0
      const codRestricted = hasOversizedItem && shippingConfig.oversizedCodRestricted

      return {
        sellerId,
        sellerName: seller?.businessName ?? '',
        sellerRatingAvg: seller?.ratingAvg ?? 0,
        sellerRatingCount: seller?.ratingCount ?? 0,
        items,
        subtotalPaise,
        discountPaise,
        taxableValuePaise,
        isInterState: interState,
        cgstPaise,
        sgstPaise,
        igstPaise,
        taxPaise,
        shippingZone,
        shippingPaise,
        freeShippingRemainingPaise,
        etaDaysMin,
        etaDaysMax,
        viaSurfaceTransport,
        codRestricted,
        totalPaise: taxableValuePaise + taxPaise + shippingPaise,
      }
    }),
  )

  sellerGroups.sort((a, b) => a.sellerName.localeCompare(b.sellerName))

  const subtotalPaise = sellerGroups.reduce((sum, group) => sum + group.subtotalPaise, 0)
  const discountPaise = sellerGroups.reduce((sum, group) => sum + group.discountPaise, 0)
  const taxableValuePaise = sellerGroups.reduce((sum, group) => sum + group.taxableValuePaise, 0)
  const cgstPaise = sellerGroups.reduce((sum, group) => sum + group.cgstPaise, 0)
  const sgstPaise = sellerGroups.reduce((sum, group) => sum + group.sgstPaise, 0)
  const igstPaise = sellerGroups.reduce((sum, group) => sum + group.igstPaise, 0)
  const taxPaise = sellerGroups.reduce((sum, group) => sum + group.taxPaise, 0)
  const shippingPaise = sellerGroups.reduce((sum, group) => sum + group.shippingPaise, 0)
  const totalPaise = sellerGroups.reduce((sum, group) => sum + group.totalPaise, 0)

  return {
    sellerGroups,
    unavailableListingIds,
    subtotalPaise,
    discountPaise,
    shippingPaise,
    taxableValuePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    taxPaise,
    totalPaise,
    coupon: couponResult,
    freeShippingThresholdPaise: shippingConfig.freeShippingThresholdPaise,
    notices: !pincode && resolvedLines.length > 0 ? [{ code: 'no_shipping_address' as const }] : [],
    pricedAt: Date.now(),
  }
}

/**
 * Callable wrapper around computePriceCart. Public (no auth required) so a
 * signed-out guest's cart page shows the same trustworthy totals as a
 * signed-in buyer's.
 */
export const priceCart = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<PriceCartResult> => {
  const parsed = priceCartRequestSchema.safeParse(request.data)
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'A valid list of cart items is required')
  }
  return computePriceCart(parsed.data)
})
