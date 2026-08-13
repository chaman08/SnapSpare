import type { IndianStateCode } from '../constants/states'
import type { Paise } from '../types/money'
import { splitProportionally } from '../types/money'

/**
 * Admin-tunable GST-compliance rates/thresholds (design brief Phase 11).
 * Firestore-backed at `config/tax` (schemas/taxConfig.ts's `TaxConfig`) —
 * see functions/src/tax/taxConfig.ts — with `DEFAULT_TAX_CONFIG` below as
 * the fallback, same split as shipping's `ShippingRateConfig`/
 * `DEFAULT_SHIPPING_CONFIG` (pricing/shipping.ts).
 *
 * IMPORTANT: every rate/threshold here is configuration, not a hardcoded
 * constant, and every one of them changes when the government amends GST
 * notifications or the Finance Act. Review with a chartered accountant
 * before go-live and before any figure is changed in production — see the
 * README's "Tax compliance" section.
 */
export interface TaxRateConfig {
  /** Total Section 52 TCS rate, e.g. 1 for the current 0.5% CGST + 0.5% SGST (intra-state) / 1% IGST (inter-state) split. */
  tcsRatePercent: number
  /** Section 194-O TDS rate on gross sales to resident e-commerce participants, e.g. 1. */
  tdsRatePercent: number
  /** Cumulative FY gross-sales threshold below which Section 194-O TDS is not required for an individual/HUF seller who has furnished PAN (proviso to 194-O(1)). Companies/firms/LLPs have no such threshold. */
  tdsIndividualHufExemptionThresholdPaise: Paise
  /** Consignment value (tax-inclusive) at/above which an e-way bill is mandatory under CGST Rule 138 — currently ₹50,000. */
  ewayBillThresholdPaise: Paise
}

export const DEFAULT_TAX_CONFIG: TaxRateConfig = {
  tcsRatePercent: 1,
  tdsRatePercent: 1,
  tdsIndividualHufExemptionThresholdPaise: 500000_00,
  ewayBillThresholdPaise: 50000_00,
}

export interface GstSplit {
  cgstPaise: Paise
  sgstPaise: Paise
  igstPaise: Paise
  totalPaise: Paise
}

/** Splits a total tax amount into CGST+SGST (intra-state, half the rate each) or IGST (inter-state, full rate) — the same rule used for line-item GST throughout checkout (cart/priceCart.ts), reused here for TCS. */
export function splitGst(taxPaise: Paise, isInterState: boolean): GstSplit {
  if (isInterState) {
    return { cgstPaise: 0, sgstPaise: 0, igstPaise: taxPaise, totalPaise: taxPaise }
  }
  const [cgstPaise, sgstPaise] = splitProportionally(taxPaise, [1, 1])
  return { cgstPaise: cgstPaise ?? 0, sgstPaise: sgstPaise ?? 0, igstPaise: 0, totalPaise: taxPaise }
}

/**
 * Section 52 TCS: `tcsRatePercent` of the net value of taxable supplies made
 * through the platform by this seller (goods value net of platform
 * discounts, excluding GST and shipping — the "net taxable supplies"
 * figure used for GSTR-8). Split CGST+SGST/IGST exactly like any other GST
 * amount based on place of supply.
 */
export function computeTcs(netTaxableValuePaise: Paise, isInterState: boolean, config: TaxRateConfig): GstSplit {
  const totalPaise = Math.round((netTaxableValuePaise * config.tcsRatePercent) / 100)
  return splitGst(totalPaise, isInterState)
}

export interface TdsComputationInput {
  /** Gross sale value excluding GST (goods/services value, not the tax component — CBDT Circular 20/2021 excludes GST shown separately) for this seller in this transaction. */
  grossSaleExGstPaise: Paise
  /** This seller's cumulative gross sales (same ex-GST basis) already recorded in the current financial year, *before* this transaction — used only to test the individual/HUF exemption threshold. */
  cumulativeFyGrossSaleExGstPaise: Paise
  sellerBusinessType: 'individual' | 'proprietorship' | 'partnership' | 'pvt_ltd' | 'llp' | 'other'
}

/**
 * Section 194-O TDS: `tdsRatePercent` of the gross sale value, deducted at
 * the time of credit/payment to the seller. Individual/HUF-equivalent
 * sellers (this codebase's closest match: `individual`/`proprietorship`
 * business types) below the configured cumulative FY threshold are exempt
 * per the proviso to 194-O(1); every other business type has no threshold.
 */
export function computeTds(input: TdsComputationInput, config: TaxRateConfig): Paise {
  const isThresholdEligible = input.sellerBusinessType === 'individual' || input.sellerBusinessType === 'proprietorship'
  if (isThresholdEligible) {
    const cumulativeAfter = input.cumulativeFyGrossSaleExGstPaise + input.grossSaleExGstPaise
    if (cumulativeAfter <= config.tdsIndividualHufExemptionThresholdPaise) return 0
    // Only the portion crossing the threshold is subject to TDS.
    const taxableSlice = Math.max(0, cumulativeAfter - Math.max(input.cumulativeFyGrossSaleExGstPaise, config.tdsIndividualHufExemptionThresholdPaise))
    return Math.round((taxableSlice * config.tdsRatePercent) / 100)
  }
  return Math.round((input.grossSaleExGstPaise * config.tdsRatePercent) / 100)
}

/** Whether place of supply requires CGST+SGST (same state) or IGST (different state) — re-exported here so tax.ts callers don't also need to import constants/states directly. */
export function isSameStateSupply(sellerStateCode: IndianStateCode, buyerStateCode: IndianStateCode): boolean {
  return sellerStateCode === buyerStateCode
}

/** Whether a shipment's tax-inclusive consignment value requires an e-way bill under CGST Rule 138. */
export function requiresEwayBill(consignmentValuePaise: Paise, config: TaxRateConfig): boolean {
  return consignmentValuePaise >= config.ewayBillThresholdPaise
}
