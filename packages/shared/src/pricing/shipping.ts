import type { IndianStateCode } from '../constants/states'
import type { Paise } from '../types/money'

export const SHIPPING_ZONES = ['zone_local', 'zone_regional', 'zone_national', 'zone_remote'] as const
export type ShippingZone = (typeof SHIPPING_ZONES)[number]

/**
 * Broad logistics regions used only to tell "regional" (same region, different
 * state — typically 1-2 day surface transit) apart from "national" (cross-region).
 * Union territories are grouped with their nearest mainland region.
 */
const REGION_BY_STATE_CODE: Record<IndianStateCode, 'north' | 'west' | 'south' | 'east' | 'central' | 'remote'> = {
  '01': 'remote', // Jammu and Kashmir
  '02': 'north', // Himachal Pradesh
  '03': 'north', // Punjab
  '04': 'north', // Chandigarh
  '05': 'north', // Uttarakhand
  '06': 'north', // Haryana
  '07': 'north', // Delhi
  '08': 'north', // Rajasthan
  '09': 'north', // Uttar Pradesh
  '10': 'east', // Bihar
  '11': 'remote', // Sikkim
  '12': 'remote', // Arunachal Pradesh
  '13': 'remote', // Nagaland
  '14': 'remote', // Manipur
  '15': 'remote', // Mizoram
  '16': 'remote', // Tripura
  '17': 'remote', // Meghalaya
  '18': 'remote', // Assam
  '19': 'east', // West Bengal
  '20': 'east', // Jharkhand
  '21': 'east', // Odisha
  '22': 'central', // Chhattisgarh
  '23': 'central', // Madhya Pradesh
  '24': 'west', // Gujarat
  '26': 'west', // Dadra and Nagar Haveli and Daman and Diu
  '27': 'west', // Maharashtra
  '29': 'south', // Karnataka
  '30': 'west', // Goa
  '31': 'remote', // Lakshadweep
  '32': 'south', // Kerala
  '33': 'south', // Tamil Nadu
  '34': 'south', // Puducherry
  '35': 'remote', // Andaman and Nicobar Islands
  '36': 'south', // Telangana
  '37': 'south', // Andhra Pradesh
  '38': 'remote', // Ladakh
}

/** J&K, Ladakh, the North-East states and island UTs — every one of them already resolves to `zone_remote` via REGION_BY_STATE_CODE, called out here only because config/admin UI needs a human label for "special zone" surcharge explanations. */
export const SPECIAL_ZONE_STATE_CODES: readonly IndianStateCode[] = (
  Object.entries(REGION_BY_STATE_CODE) as [IndianStateCode, string][]
)
  .filter(([, region]) => region === 'remote')
  .map(([code]) => code)

/**
 * Structurally identical to schemas/shipping.ts's zod-inferred
 * `ShippingZoneRate` — a distinctly-named twin (not the same export) so
 * this file stays zod-free while a Firestore-parsed `ShippingConfig` (a
 * superset, with `id`/`updatedAt`) still satisfies `ShippingRateConfig`
 * structurally wherever it's passed in.
 */
export interface ShippingZoneRateConfig {
  baseFarePaise: Paise
  perKgPaise: Paise
  etaDaysMin: number
  etaDaysMax: number
}

/**
 * Admin-tunable shipping cost model (design brief item 4: zone matrix,
 * weight slabs/per-kg increments, free-shipping threshold, oversized
 * handling). Firestore-backed at `config/shipping` (schemas/shipping.ts's
 * `ShippingConfig`) — see functions/src/shipping/shippingConfig.ts — with
 * `DEFAULT_SHIPPING_CONFIG` below as the fallback so every function in this
 * package stays pure/Firestore-free and behaves exactly as before when no
 * config doc exists.
 */
export interface ShippingRateConfig {
  zones: Record<ShippingZone, ShippingZoneRateConfig>
  /** Per-seller subtotal at/above this threshold ships free, regardless of zone. Overridable per-seller — see sellerSchema.freeShippingThresholdPaise. */
  freeShippingThresholdPaise: Paise
  /** Extra transit days added to a zone's ETA when the shipment contains an oversized item (bumpers, panels, batteries — routed to surface transport instead of air/express). */
  oversizedEtaExtraDays: number
  /** Whether an oversized item in the cart blocks Cash on Delivery outright. */
  oversizedCodRestricted: boolean
  /** cm³-per-kg divisor used to convert L×W×H into volumetric weight (5000 is the courier-industry standard for surface shipments). */
  volumetricDivisorCm3PerKg: number
}

export const DEFAULT_SHIPPING_CONFIG: ShippingRateConfig = {
  zones: {
    zone_local: { baseFarePaise: 4000, perKgPaise: 1500, etaDaysMin: 1, etaDaysMax: 2 },
    zone_regional: { baseFarePaise: 6000, perKgPaise: 2000, etaDaysMin: 2, etaDaysMax: 4 },
    zone_national: { baseFarePaise: 8000, perKgPaise: 2500, etaDaysMin: 3, etaDaysMax: 6 },
    zone_remote: { baseFarePaise: 12000, perKgPaise: 4000, etaDaysMin: 5, etaDaysMax: 9 },
  },
  freeShippingThresholdPaise: 999900,
  oversizedEtaExtraDays: 3,
  oversizedCodRestricted: true,
  volumetricDivisorCm3PerKg: 5000,
}

/** A listing with no `weightGrams` set is priced as if it weighed this much. */
export const DEFAULT_LISTING_WEIGHT_GRAMS = 500

/** @deprecated kept for any lingering import — prefer `config.freeShippingThresholdPaise` (see DEFAULT_SHIPPING_CONFIG). */
export const FREE_SHIPPING_THRESHOLD_PAISE: Paise = DEFAULT_SHIPPING_CONFIG.freeShippingThresholdPaise

export function resolveShippingZone(sellerStateCode: IndianStateCode, buyerStateCode: IndianStateCode): ShippingZone {
  if (sellerStateCode === buyerStateCode) return 'zone_local'
  const sellerRegion = REGION_BY_STATE_CODE[sellerStateCode]
  const buyerRegion = REGION_BY_STATE_CODE[buyerStateCode]
  if (sellerRegion === 'remote' || buyerRegion === 'remote') return 'zone_remote'
  return sellerRegion === buyerRegion ? 'zone_regional' : 'zone_national'
}

/**
 * Structurally identical to schemas/shipping.ts's zod-inferred
 * `DimensionsCm` — a distinctly-named twin so this file has no zod
 * dependency, matching the rest of this pure computation package; the
 * zod-inferred type satisfies this one structurally wherever it's passed in.
 */
export interface ShippingDimensionsCm {
  lengthCm: number
  widthCm: number
  heightCm: number
}

/** Volumetric ("dimensional") weight in grams — what a bulky-but-light package is charged as by every Indian courier, not its actual scale weight. */
export function computeVolumetricWeightGrams(
  dimensions: ShippingDimensionsCm,
  divisorCm3PerKg: number = DEFAULT_SHIPPING_CONFIG.volumetricDivisorCm3PerKg,
): number {
  const volumeCm3 = dimensions.lengthCm * dimensions.widthCm * dimensions.heightCm
  return Math.ceil((volumeCm3 / divisorCm3PerKg) * 1000)
}

/** A courier always charges for whichever is greater — a bulky-but-light bumper box ships at its volumetric weight, a dense-but-small brake caliper at its actual weight. */
export function computeChargeableWeightGrams(
  actualWeightGrams: number,
  dimensions: ShippingDimensionsCm | undefined,
  divisorCm3PerKg: number = DEFAULT_SHIPPING_CONFIG.volumetricDivisorCm3PerKg,
): number {
  if (!dimensions) return actualWeightGrams
  return Math.max(actualWeightGrams, computeVolumetricWeightGrams(dimensions, divisorCm3PerKg))
}

export interface ShippingEstimate {
  zone: ShippingZone
  shippingPaise: Paise
  etaDaysMin: number
  etaDaysMax: number
  /** True when an oversized item pushed this estimate onto surface transport (extended ETA, see `oversizedEtaExtraDays`). */
  viaSurfaceTransport: boolean
}

export interface EstimateSellerShippingOptions {
  /** Any line in this seller's shipment is flagged `isOversized` (bumpers, panels, batteries — see schemas/listing.ts). */
  isOversized?: boolean
  /** This seller's own `freeShippingThresholdPaise` (schemas/seller.ts), used instead of `config.freeShippingThresholdPaise` when set. */
  freeShippingThresholdOverridePaise?: Paise
}

/**
 * Shipping charge for one seller's portion of an order: free above the
 * threshold, otherwise the zone's base fare plus a per-kg charge for total
 * weight beyond the first kg (rounded up to the next whole kg). `config`
 * defaults to `DEFAULT_SHIPPING_CONFIG` so existing callers that don't pass
 * one keep today's exact behavior.
 */
export function estimateSellerShipping(
  zone: ShippingZone,
  totalWeightGrams: number,
  sellerSubtotalPaise: Paise,
  config: ShippingRateConfig = DEFAULT_SHIPPING_CONFIG,
  options: EstimateSellerShippingOptions = {},
): ShippingEstimate {
  const rate = config.zones[zone]
  const extraKg = Math.max(0, Math.ceil(totalWeightGrams / 1000) - 1)
  const rawShippingPaise = rate.baseFarePaise + extraKg * rate.perKgPaise
  const threshold = options.freeShippingThresholdOverridePaise ?? config.freeShippingThresholdPaise
  const shippingPaise = sellerSubtotalPaise >= threshold ? 0 : rawShippingPaise

  const viaSurfaceTransport = options.isOversized === true
  const etaExtraDays = viaSurfaceTransport ? config.oversizedEtaExtraDays : 0

  return {
    zone,
    shippingPaise,
    etaDaysMin: rate.etaDaysMin + etaExtraDays,
    etaDaysMax: rate.etaDaysMax + etaExtraDays,
    viaSurfaceTransport,
  }
}
