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

const API_BASE = 'https://apiv2.shiprocket.in/v1/external'

interface ShiprocketAuthResponse {
  token: string
}

interface ShiprocketCourierOption {
  courier_name: string
  rate: number
  cod: number
  estimated_delivery_days?: string
  etd?: string
}

interface ShiprocketServiceabilityResponse {
  data?: { available_courier_companies?: ShiprocketCourierOption[] }
}

interface ShiprocketCreateOrderResponse {
  order_id: number
  shipment_id: number
  awb_code?: string
  courier_name?: string
}

interface ShiprocketTrackCheckpoint {
  status: string
  location?: string
  date: string
}

interface ShiprocketTrackResponse {
  tracking_data?: {
    shipment_status?: string
    shipment_track_activities?: ShiprocketTrackCheckpoint[]
  }
}

interface ShiprocketLabelResponse {
  label_url?: string
}

/**
 * Real integration against Shiprocket's documented `v1/external` REST API.
 * A thin fetch-based client (same reasoning as checkout/razorpayClient.ts —
 * Node 20's built-in `fetch` covers the handful of endpoints this needs
 * without an unpinned third-party SDK). The auth token is cached on the
 * instance and refreshed on expiry/401 — cheap because Cloud Function
 * instances are warm-reused across invocations, so most calls skip the
 * login round-trip entirely. Never constructed directly by a callable; see
 * provider.ts for the swap point and functions/src/shipping/secrets.ts for
 * where the credentials come from.
 */
export class ShiprocketProvider implements ShippingProvider {
  private token: string | undefined
  private tokenExpiresAt = 0

  constructor(
    private readonly email: string,
    private readonly password: string,
  ) {}

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token

    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
    })
    if (!response.ok) {
      throw new Error(`Shiprocket login failed (${response.status}): ${await response.text().catch(() => '')}`)
    }
    const body = (await response.json()) as ShiprocketAuthResponse
    this.token = body.token
    // Shiprocket tokens are valid ~10 days; refresh a day early to be safe.
    this.tokenExpiresAt = Date.now() + 9 * 24 * 60 * 60_000
    return this.token
  }

  private async request<T>(path: string, init: RequestInit, retryOn401 = true): Promise<T> {
    const token = await this.getToken()
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })

    if (response.status === 401 && retryOn401) {
      this.token = undefined
      return this.request<T>(path, init, false)
    }
    if (!response.ok) {
      throw new Error(`Shiprocket request to ${path} failed (${response.status}): ${await response.text().catch(() => '')}`)
    }
    return (await response.json()) as T
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const result = await this.request<ShiprocketCreateOrderResponse>('/orders/create/adhoc', {
      method: 'POST',
      body: JSON.stringify({
        order_id: input.subOrderId,
        order_date: new Date().toISOString().slice(0, 10),
        billing_customer_name: input.deliveryAddress.name,
        billing_phone: input.deliveryAddress.phone,
        billing_address: input.deliveryAddress.addressLine1,
        billing_address_2: input.deliveryAddress.addressLine2 ?? '',
        billing_city: input.deliveryAddress.city,
        billing_state: input.deliveryAddress.state,
        billing_pincode: input.deliveryAddress.pincode,
        billing_country: 'India',
        shipping_is_billing: true,
        order_items: input.items.map((item) => ({
          name: item.name,
          sku: item.sku,
          units: item.qty,
          selling_price: item.unitPricePaise / 100,
        })),
        payment_method: input.codAmountPaise !== undefined ? 'COD' : 'Prepaid',
        sub_total: input.declaredValuePaise / 100,
        weight: input.package.weightGrams / 1000,
        length: input.package.dimensionsCm?.lengthCm,
        breadth: input.package.dimensionsCm?.widthCm,
        height: input.package.dimensionsCm?.heightCm,
        pickup_location: input.pickupAddress.name,
      }),
    })

    return {
      providerShipmentId: String(result.shipment_id),
      providerOrderId: String(result.order_id),
      awb: result.awb_code || undefined,
      courier: result.courier_name || undefined,
    }
  }

  /** Shiprocket's documented `/orders/create/return` endpoint — same request shape as a forward order but with pickup/delivery addresses swapped and an `order_type` marker; see https://apidocs.shiprocket.in (Create Return Order). */
  async createReversePickup(input: CreateReversePickupInput): Promise<CreateShipmentResult> {
    const result = await this.request<ShiprocketCreateOrderResponse>('/orders/create/return', {
      method: 'POST',
      body: JSON.stringify({
        order_id: `RVP-${input.returnId}`,
        order_date: new Date().toISOString().slice(0, 10),
        // Pickup leg — the buyer's address (the courier collects from here).
        pickup_customer_name: input.pickupAddress.name,
        pickup_phone: input.pickupAddress.phone,
        pickup_address: input.pickupAddress.addressLine1,
        pickup_address_2: input.pickupAddress.addressLine2 ?? '',
        pickup_city: input.pickupAddress.city,
        pickup_state: input.pickupAddress.state,
        pickup_pincode: input.pickupAddress.pincode,
        pickup_country: 'India',
        // Delivery leg — the seller's warehouse (the courier drops off here).
        shipping_customer_name: input.dropAddress.name,
        shipping_phone: input.dropAddress.phone,
        shipping_address: input.dropAddress.addressLine1,
        shipping_address_2: input.dropAddress.addressLine2 ?? '',
        shipping_city: input.dropAddress.city,
        shipping_state: input.dropAddress.state,
        shipping_pincode: input.dropAddress.pincode,
        shipping_country: 'India',
        order_items: input.items.map((item) => ({
          name: item.name,
          sku: item.sku,
          units: item.qty,
          selling_price: item.unitPricePaise / 100,
        })),
        payment_method: 'Prepaid',
        sub_total: input.declaredValuePaise / 100,
        weight: input.package.weightGrams / 1000,
        length: input.package.dimensionsCm?.lengthCm,
        breadth: input.package.dimensionsCm?.widthCm,
        height: input.package.dimensionsCm?.heightCm,
      }),
    })

    return {
      providerShipmentId: String(result.shipment_id),
      providerOrderId: String(result.order_id),
      awb: result.awb_code || undefined,
      courier: result.courier_name || undefined,
    }
  }

  async getRates(input: GetRatesInput): Promise<RateQuote[]> {
    const params = new URLSearchParams({
      pickup_postcode: input.originPincode,
      delivery_postcode: input.destPincode,
      weight: String(input.weightGrams / 1000),
      cod: input.codAmountPaise !== undefined ? '1' : '0',
    })
    const result = await this.request<ShiprocketServiceabilityResponse>(`/courier/serviceability/?${params.toString()}`, {
      method: 'GET',
    })

    return (result.data?.available_courier_companies ?? []).map((courier) => {
      const [etaDaysMin, etaDaysMax] = parseEtaDays(courier.estimated_delivery_days ?? courier.etd)
      return {
        courier: courier.courier_name,
        ratePaise: Math.round(courier.rate * 100),
        etaDaysMin,
        etaDaysMax,
        codAvailable: courier.cod === 1,
      }
    })
  }

  async schedulePickup(input: SchedulePickupInput): Promise<SchedulePickupResult> {
    await this.request('/courier/generate/pickup', {
      method: 'POST',
      body: JSON.stringify({ shipment_id: [input.providerShipmentId], pickup_date: [input.pickupDate] }),
    })
    return { pickupScheduledAt: Date.now() }
  }

  async trackAwb(awb: string): Promise<TrackAwbResult> {
    const result = await this.request<ShiprocketTrackResponse>(`/courier/track/awb/${awb}`, { method: 'GET' })
    const activities = result.tracking_data?.shipment_track_activities ?? []
    return {
      status: result.tracking_data?.shipment_status ?? 'UNKNOWN',
      currentLocation: activities[0]?.location,
      checkpoints: activities.map((activity) => ({
        status: activity.status,
        location: activity.location,
        at: Date.parse(activity.date) || Date.now(),
      })),
    }
  }

  async cancelShipment(providerShipmentId: string): Promise<void> {
    await this.request('/orders/cancel', {
      method: 'POST',
      body: JSON.stringify({ ids: [Number(providerShipmentId)] }),
    })
  }

  async generateLabel(providerShipmentId: string): Promise<GenerateLabelResult> {
    const result = await this.request<ShiprocketLabelResponse>('/courier/generate/label', {
      method: 'POST',
      body: JSON.stringify({ shipment_id: [providerShipmentId] }),
    })
    if (!result.label_url) throw new Error('Shiprocket did not return a label URL')

    const labelResponse = await fetch(result.label_url)
    if (!labelResponse.ok) throw new Error(`Failed to download Shiprocket label (${labelResponse.status})`)
    const labelBytes = Buffer.from(await labelResponse.arrayBuffer())
    return { labelBytes, contentType: 'application/pdf' }
  }
}

/** Shiprocket's serviceability response reports ETA as a free-text string like "3-5" or "4" days — parsed defensively since the exact format isn't contractually guaranteed. */
function parseEtaDays(raw: string | undefined): [number, number] {
  if (!raw) return [3, 6]
  const numbers = raw.match(/\d+/g)?.map(Number) ?? []
  if (numbers.length === 0) return [3, 6]
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  return [min, max]
}
