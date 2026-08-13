import type { CatalogPart } from '@snapspare/shared'

export type BulkRow = Record<string, unknown>

function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function str(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const s = String(value).trim()
  return s === '' ? undefined : s
}

function bool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  const s = String(value ?? '').trim().toUpperCase()
  return s === 'TRUE' || s === '1' || s === 'YES'
}

function toPaiseFromRupees(rupees: number | undefined): number | undefined {
  return rupees === undefined ? undefined : Math.round(rupees * 100)
}

export interface BulkRowMappingResult {
  candidate?: Record<string, unknown>
  /** Set when the row can't even be attempted (missing partNumber, unresolvable catalogPart, etc.) — these never reach `validateListing`. */
  earlyError?: string
}

/**
 * Maps one flat spreadsheet row (see BULK_UPLOAD_COLUMNS) plus its resolved
 * catalogPart into a listing candidate object ready for
 * `persistListing.ts`'s `validateListing`. Supports up to 3 tiers — see
 * BULK_UPLOAD_COLUMNS' header comment for why bulk upload deliberately
 * doesn't attempt a richer shape.
 */
export function mapBulkRowToListingCandidate(row: BulkRow, sellerId: string, catalogPart: CatalogPart): BulkRowMappingResult {
  const sku = str(row.sku)
  const condition = str(row.condition)?.toLowerCase()
  const stockQty = num(row.stockQty)
  const moq = num(row.moq)
  const stepQty = num(row.stepQty) ?? 1
  const tier1MaxQty = num(row.tier1MaxQty)
  const tier1Price = toPaiseFromRupees(num(row.tier1UnitPriceRupees))
  const tier2MaxQty = num(row.tier2MaxQty)
  const tier2Price = toPaiseFromRupees(num(row.tier2UnitPriceRupees))
  const tier3Price = toPaiseFromRupees(num(row.tier3UnitPriceRupees))

  if (!sku) return { earlyError: 'Missing SKU' }
  if (!condition) return { earlyError: 'Missing condition' }
  if (stockQty === undefined) return { earlyError: 'Missing or invalid stock quantity' }
  if (moq === undefined) return { earlyError: 'Missing or invalid MOQ' }
  if (tier1Price === undefined) return { earlyError: 'Missing or invalid Tier 1 price' }

  const tiers: { minQty: number; maxQty: number | null; unitPricePaise: number }[] = []
  if (tier2Price !== undefined && tier1MaxQty !== undefined) {
    tiers.push({ minQty: moq, maxQty: tier1MaxQty, unitPricePaise: tier1Price })
    if (tier3Price !== undefined && tier2MaxQty !== undefined) {
      tiers.push({ minQty: tier1MaxQty + 1, maxQty: tier2MaxQty, unitPricePaise: tier2Price })
      tiers.push({ minQty: tier2MaxQty + 1, maxQty: null, unitPricePaise: tier3Price })
    } else {
      tiers.push({ minQty: tier1MaxQty + 1, maxQty: null, unitPricePaise: tier2Price })
    }
  } else {
    tiers.push({ minQty: moq, maxQty: null, unitPricePaise: tier1Price })
  }

  const mrpRupees = num(row.mrpRupees)
  const gstRatePercent = num(row.gstRatePercent) ?? catalogPart.gstRatePercent
  const weightGrams = num(row.weightGrams)
  const warrantyMonths = num(row.warrantyMonths)

  return {
    candidate: {
      partId: catalogPart.id,
      sellerId,
      sku,
      title: catalogPart.name,
      condition,
      stockQty,
      reservedStock: 0,
      pricing: { moq, stepQty, tiers },
      mrpPaise: toPaiseFromRupees(mrpRupees),
      taxIncluded: bool(row.taxIncluded),
      hsnCode: str(row.hsnCode) ?? catalogPart.hsnCode,
      gstRatePercent,
      weightGrams,
      isOversized: bool(row.isOversized),
      images: [],
      status: 'draft',
      isFeatured: false,
      viewCount: 0,
      warrantyMonths,
    },
  }
}
