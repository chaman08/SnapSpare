import { DEFAULT_SHIPPING_CONFIG, estimateSellerShipping, isValidStateCode, pincodeMasterSchema, resolveShippingZone } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import type {
  CreateReversePickupInput,
  CreateShipmentInput,
  CreateShipmentResult,
  GenerateLabelResult,
  GetRatesInput,
  RateQuote,
  SchedulePickupInput,
  SchedulePickupResult,
  ShippingProvider,
  TrackAwbResult,
} from './shippingProvider.js'

const MOCK_COURIERS = ['Delhivery Surface', 'Delhivery Express', 'Ecom Express'] as const

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

async function lookupStateCode(db: ReturnType<typeof getFirestore>, pincode: string): Promise<string | undefined> {
  const snapshot = await db.collection('pincodes').doc(pincode).get()
  if (!snapshot.exists) return undefined
  const parsed = pincodeMasterSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
  return parsed.success ? parsed.data.stateCode : undefined
}

/**
 * **Development stand-in only.** No Shiprocket account is wired up in this
 * environment (see shiprocketProvider.ts for the real integration, and
 * provider.ts for the swap point). Rates/ETA are derived from the same
 * zone/weight heuristic priceCart already uses
 * (packages/shared/src/pricing/shipping.ts) when both pincodes resolve via
 * the `pincodes` master collection, falling back to a hash-derived zone
 * otherwise so this never hard-fails in a thinly-seeded dev environment.
 * `trackAwb` has no real shipment state to report — it deterministically
 * derives a status from the AWB string itself (not from elapsed time), so
 * the same AWB always reports the same status; this is enough to exercise
 * the webhook/reconciliation/NDR code paths in dev, not a real tracking
 * simulation. Must be replaced before production launch.
 */
export class MockShippingProvider implements ShippingProvider {
  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const hash = hashString(input.subOrderId)
    return {
      providerShipmentId: `MOCKSHP-${hash}`,
      providerOrderId: `MOCKORD-${hash}`,
    }
  }

  async createReversePickup(input: CreateReversePickupInput): Promise<CreateShipmentResult> {
    const hash = hashString(`reverse-${input.returnId}`)
    return {
      providerShipmentId: `MOCKRVP-${hash}`,
      providerOrderId: `MOCKRVPORD-${hash}`,
    }
  }

  async getRates(input: GetRatesInput): Promise<RateQuote[]> {
    const db = getFirestore()
    const [originStateCode, destStateCode] = await Promise.all([
      lookupStateCode(db, input.originPincode),
      lookupStateCode(db, input.destPincode),
    ])

    const fallbackZones = ['zone_local', 'zone_regional', 'zone_national', 'zone_remote'] as const
    const zone =
      originStateCode && destStateCode && isValidStateCode(originStateCode) && isValidStateCode(destStateCode)
        ? resolveShippingZone(originStateCode, destStateCode)
        : (fallbackZones[hashString(`${input.originPincode}${input.destPincode}`) % fallbackZones.length] ??
          'zone_national')

    const estimate = estimateSellerShipping(zone, input.weightGrams, 0, DEFAULT_SHIPPING_CONFIG)
    const hash = hashString(`${input.originPincode}${input.destPincode}${input.weightGrams}`)

    return MOCK_COURIERS.map((courier, index) => ({
      courier,
      // A small deterministic spread around the zone-matrix estimate so the multi-courier UI has something to compare.
      ratePaise: Math.round(estimate.shippingPaise * (1 + (((hash + index) % 20) - 10) / 100)),
      etaDaysMin: estimate.etaDaysMin + index,
      etaDaysMax: estimate.etaDaysMax + index,
      codAvailable: input.codAmountPaise === undefined || (hash + index) % 7 !== 0,
    }))
  }

  async schedulePickup(_input: SchedulePickupInput): Promise<SchedulePickupResult> {
    return { pickupScheduledAt: Date.now() }
  }

  async trackAwb(awb: string): Promise<TrackAwbResult> {
    const hash = hashString(awb)
    // Mostly "delivered" (the common case, so dev flows can proceed end to end); occasionally NDR/RTO so those paths are exercisable too.
    const status = hash % 10 === 0 ? 'UNDELIVERED' : hash % 17 === 0 ? 'RTO DELIVERED' : 'DELIVERED'
    return {
      status,
      checkpoints: [{ status, at: Date.now() }],
    }
  }

  async cancelShipment(_providerShipmentId: string): Promise<void> {
    // No real booking to cancel.
  }

  async generateLabel(providerShipmentId: string): Promise<GenerateLabelResult> {
    const text = `SnapSpare mock shipping label\nShipment: ${providerShipmentId}\nGenerated: ${new Date().toISOString()}\n\nThis is a development placeholder, not a real courier label PDF.`
    return { labelBytes: Buffer.from(text, 'utf8'), contentType: 'text/plain' }
  }
}
