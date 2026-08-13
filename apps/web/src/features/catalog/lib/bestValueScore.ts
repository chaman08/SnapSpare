export interface ScorableOffer {
  listingId: string
  unitPriceAtQty1Paise: number
  ratingAvg: number
  ratingCount: number
  deliveryEtaDays: number
}

const WEIGHTS = { price: 0.5, rating: 0.3, eta: 0.2 }

function normalizeLowerIsBetter(value: number, min: number, max: number): number {
  return max === min ? 1 : 1 - (value - min) / (max - min)
}

/**
 * "Best value" for the seller comparison strip's default selection: a
 * weighted blend of price (50%), rating (30%) and delivery speed (20%),
 * each min-max normalised across the offers actually on the page — this is
 * a *relative* ranking among this part's sellers, not an absolute quality
 * score. An unrated seller (ratingCount 0) is scored as neutral (0.5)
 * rather than worst-case, so a new seller with a genuinely better price
 * isn't buried under untested incumbents.
 */
export function pickBestValueListingId(offers: ScorableOffer[]): string | undefined {
  if (offers.length === 0) return undefined
  if (offers.length === 1) return offers[0]?.listingId

  const prices = offers.map((o) => o.unitPriceAtQty1Paise)
  const etas = offers.map((o) => o.deliveryEtaDays)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const minEta = Math.min(...etas)
  const maxEta = Math.max(...etas)

  let best = offers[0]
  let bestScore = -Infinity

  for (const offer of offers) {
    const priceScore = normalizeLowerIsBetter(offer.unitPriceAtQty1Paise, minPrice, maxPrice)
    const ratingScore = offer.ratingCount > 0 ? offer.ratingAvg / 5 : 0.5
    const etaScore = normalizeLowerIsBetter(offer.deliveryEtaDays, minEta, maxEta)
    const score = priceScore * WEIGHTS.price + ratingScore * WEIGHTS.rating + etaScore * WEIGHTS.eta

    if (score > bestScore) {
      bestScore = score
      best = offer
    }
  }

  return best?.listingId
}
