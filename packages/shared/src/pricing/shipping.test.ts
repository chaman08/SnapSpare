import { describe, expect, it } from 'vitest'
import {
  computeChargeableWeightGrams,
  computeVolumetricWeightGrams,
  DEFAULT_SHIPPING_CONFIG,
  estimateSellerShipping,
  resolveShippingZone,
} from './shipping'

describe('resolveShippingZone', () => {
  it('is local when seller and buyer share a state', () => {
    expect(resolveShippingZone('27', '27')).toBe('zone_local') // Maharashtra -> Maharashtra
  })

  it('is regional within the same broad region', () => {
    expect(resolveShippingZone('27', '24')).toBe('zone_regional') // Maharashtra -> Gujarat (both west)
  })

  it('is national across regions', () => {
    expect(resolveShippingZone('27', '33')).toBe('zone_national') // Maharashtra -> Tamil Nadu
  })

  it('is remote whenever either side is a special-zone state', () => {
    expect(resolveShippingZone('27', '01')).toBe('zone_remote') // Maharashtra -> Jammu and Kashmir
    expect(resolveShippingZone('18', '27')).toBe('zone_remote') // Assam -> Maharashtra
  })
})

describe('computeVolumetricWeightGrams', () => {
  it('converts L x W x H to grams using the configured divisor', () => {
    // 40 x 30 x 20 = 24000 cm3; /5000 = 4.8kg -> ceil to 4800g
    expect(computeVolumetricWeightGrams({ lengthCm: 40, widthCm: 30, heightCm: 20 })).toBe(4800)
  })
})

describe('computeChargeableWeightGrams', () => {
  it('charges actual weight for a dense, small item', () => {
    // A small 10x10x10 box (1000cm3 -> 200g volumetric) but a heavy 2kg part.
    expect(computeChargeableWeightGrams(2000, { lengthCm: 10, widthCm: 10, heightCm: 10 })).toBe(2000)
  })

  it('charges volumetric weight for a bulky, light item', () => {
    // A 60x40x30 bumper box (72000cm3 -> 14400g volumetric) but only 3kg actual.
    expect(computeChargeableWeightGrams(3000, { lengthCm: 60, widthCm: 40, heightCm: 30 })).toBe(14400)
  })

  it('falls back to actual weight when no dimensions are given', () => {
    expect(computeChargeableWeightGrams(1500, undefined)).toBe(1500)
  })
})

describe('estimateSellerShipping', () => {
  it('matches today\'s exact defaults when no config is passed', () => {
    const estimate = estimateSellerShipping('zone_local', 500, 0)
    expect(estimate).toEqual({
      zone: 'zone_local',
      shippingPaise: 4000,
      etaDaysMin: 1,
      etaDaysMax: 2,
      viaSurfaceTransport: false,
    })
  })

  it('is free at or above the free-shipping threshold', () => {
    const estimate = estimateSellerShipping('zone_national', 5000, DEFAULT_SHIPPING_CONFIG.freeShippingThresholdPaise)
    expect(estimate.shippingPaise).toBe(0)
  })

  it('honors a per-seller free-shipping threshold override', () => {
    const estimate = estimateSellerShipping('zone_national', 5000, 50000, DEFAULT_SHIPPING_CONFIG, {
      freeShippingThresholdOverridePaise: 40000,
    })
    expect(estimate.shippingPaise).toBe(0)
  })

  it('extends ETA and flags surface transport for an oversized shipment', () => {
    const estimate = estimateSellerShipping('zone_national', 5000, 0, DEFAULT_SHIPPING_CONFIG, { isOversized: true })
    expect(estimate.viaSurfaceTransport).toBe(true)
    expect(estimate.etaDaysMin).toBe(3 + DEFAULT_SHIPPING_CONFIG.oversizedEtaExtraDays)
    expect(estimate.etaDaysMax).toBe(6 + DEFAULT_SHIPPING_CONFIG.oversizedEtaExtraDays)
  })

  it('charges per extra kg beyond the first', () => {
    // zone_local: base 4000 + 2 extra kg (3000g total -> 1 free + 2 chargeable) * 1500/kg = 7000
    const estimate = estimateSellerShipping('zone_local', 3000, 0)
    expect(estimate.shippingPaise).toBe(7000)
  })
})
