import type { DimensionsCm } from '@snapspare/shared'

export interface ShippingContactAddress {
  name: string
  phone: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  pincode: string
}

export interface ShipmentPackage {
  weightGrams: number
  dimensionsCm?: DimensionsCm
}

export interface ShipmentLineItem {
  name: string
  sku: string
  qty: number
  unitPricePaise: number
}

export interface CreateShipmentInput {
  subOrderId: string
  orderId: string
  sellerId: string
  pickupAddress: ShippingContactAddress
  deliveryAddress: ShippingContactAddress
  items: ShipmentLineItem[]
  package: ShipmentPackage
  /** Present only for COD orders — the amount the courier collects on delivery. */
  codAmountPaise?: number
  declaredValuePaise: number
}

export interface CreateShipmentResult {
  providerShipmentId: string
  providerOrderId: string
  /** Some providers assign an AWB at booking time; others only after pickup — absent here means shipSubOrder.ts still needs one supplied separately. */
  awb?: string
  courier?: string
}

export interface CreateReversePickupInput {
  returnId: string
  subOrderId: string
  orderId: string
  sellerId: string
  /** Where the courier picks the item up from — the buyer's delivery address. */
  pickupAddress: ShippingContactAddress
  /** Where the courier drops the item off — the seller's warehouse origin. */
  dropAddress: ShippingContactAddress
  items: ShipmentLineItem[]
  package: ShipmentPackage
  declaredValuePaise: number
}

export interface GetRatesInput {
  originPincode: string
  destPincode: string
  weightGrams: number
  dimensionsCm?: DimensionsCm
  codAmountPaise?: number
}

export interface RateQuote {
  courier: string
  ratePaise: number
  etaDaysMin: number
  etaDaysMax: number
  codAvailable: boolean
}

export interface SchedulePickupInput {
  providerShipmentId: string
  /** YYYY-MM-DD */
  pickupDate: string
}

export interface SchedulePickupResult {
  pickupScheduledAt: number
}

export interface TrackingCheckpoint {
  status: string
  location?: string
  at: number
}

export interface TrackAwbResult {
  /** Raw, provider-specific status string — normalized by functions/src/shipping/statusMapping.ts, never interpreted directly by callers. */
  status: string
  currentLocation?: string
  checkpoints: TrackingCheckpoint[]
}

export interface GenerateLabelResult {
  labelBytes: Buffer
  contentType: string
}

/**
 * Adapter boundary for "book/track/label a shipment with a logistics
 * provider" — the same shape as `VehicleRegLookupProvider`
 * (functions/src/vehicle/regLookupProvider.ts): callables in
 * functions/src/shipping/ depend only on this interface, so swapping the
 * dev mock (mockShippingProvider.ts) for the real Shiprocket client
 * (shiprocketProvider.ts) in production is a one-line change in
 * provider.ts, never a rewrite of the callables themselves.
 */
export interface ShippingProvider {
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>
  /** Books a reverse-pickup shipment (buyer -> seller) for an approved return. Same result shape as createShipment — a reverse pickup is just a shipment with pickup/delivery swapped. */
  createReversePickup(input: CreateReversePickupInput): Promise<CreateShipmentResult>
  getRates(input: GetRatesInput): Promise<RateQuote[]>
  schedulePickup(input: SchedulePickupInput): Promise<SchedulePickupResult>
  trackAwb(awb: string): Promise<TrackAwbResult>
  cancelShipment(providerShipmentId: string): Promise<void>
  generateLabel(providerShipmentId: string): Promise<GenerateLabelResult>
}
