import type { GstRatePercent } from '@snapspare/shared'
import { applyPercent } from '@snapspare/shared'

export type GstDisplayMode = 'inclusive' | 'exclusive'

/**
 * Re-expresses an already server-priced unit price as GST-inclusive or
 * GST-exclusive for display only — this never computes a payable amount
 * (that's exclusively a Cloud Function's job at checkout). `taxIncluded`
 * says which mode `unitPricePaise` is already stored in; when it already
 * matches the requested display `mode`, the price is returned unchanged.
 */
export function toDisplayUnitPrice(
  unitPricePaise: number,
  gstRatePercent: GstRatePercent,
  taxIncluded: boolean,
  mode: GstDisplayMode,
): number {
  if (taxIncluded === (mode === 'inclusive')) return unitPricePaise

  if (mode === 'inclusive') {
    return unitPricePaise + applyPercent(unitPricePaise, gstRatePercent)
  }
  return Math.round(unitPricePaise / (1 + gstRatePercent / 100))
}

/** Business buyer types that see wholesale slab pricing and may toggle GST display — retail buyers (or signed-out visitors) never see the toggle. */
export function isBusinessBuyerType(buyerType: string | undefined): boolean {
  return buyerType === 'mechanic' || buyerType === 'garage' || buyerType === 'fleet' || buyerType === 'reseller'
}
