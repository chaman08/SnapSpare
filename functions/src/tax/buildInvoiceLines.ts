import type { InvoiceLine, SubOrderItem } from '@snapspare/shared'
import { splitProportionally } from '@snapspare/shared'

/**
 * Scales one invoice line down to the returned quantity — the credit-note
 * equivalent of orders/refundReturn.ts's
 * `Math.round((item.lineTotalPaise * ret.qty) / item.qty)` proportional
 * refund math, applied per money field so the credit note's taxable
 * value/CGST/SGST/IGST all reverse in the same proportion as the cash
 * refund.
 */
export function scaleInvoiceLineForReturn(line: InvoiceLine, returnedQty: number, originalQty: number): InvoiceLine {
  const ratio = returnedQty / originalQty
  const scale = (paise: number) => Math.round(paise * ratio)
  return {
    ...line,
    qty: returnedQty,
    taxableValuePaise: scale(line.taxableValuePaise),
    cgstPaise: scale(line.cgstPaise),
    sgstPaise: scale(line.sgstPaise),
    igstPaise: scale(line.igstPaise),
    lineTotalPaise: scale(line.lineTotalPaise),
  }
}

/**
 * Rebuilds a per-line CGST/SGST/IGST breakdown from a subOrder's items —
 * the same split cart/priceCart.ts already applies at the aggregate level
 * (per-item `splitProportionally(item.lineTaxPaise, [1, 1])`, summed into
 * `subOrder.cgstPaise`/`sgstPaise`), just retained per line instead of only
 * summed, since the invoice line table needs to show each item's own tax.
 *
 * Needs no separate "composition scheme" branch: a composition seller's
 * items already carry `lineTaxPaise: 0` (priceCart.ts zero-rates them at
 * the source), so the inter-/intra-state math below naturally produces an
 * all-zero GST column for every line without special-casing it here.
 */
export function buildInvoiceLinesFromSubOrder(items: SubOrderItem[], isInterState: boolean): InvoiceLine[] {
  return items.map((item) => {
    const taxableValuePaise = item.lineSubtotalPaise - item.lineDiscountPaise

    if (isInterState) {
      return {
        description: item.title,
        hsnCode: item.hsnCode,
        qty: item.qty,
        unitPricePaise: item.unitPricePaise,
        taxableValuePaise,
        gstRatePercent: item.gstRatePercent,
        cgstRatePercent: 0,
        cgstPaise: 0,
        sgstRatePercent: 0,
        sgstPaise: 0,
        igstRatePercent: item.gstRatePercent,
        igstPaise: item.lineTaxPaise,
        lineTotalPaise: item.lineTotalPaise,
      }
    }

    const halfRate = item.gstRatePercent / 2
    const [cgstPaise, sgstPaise] = splitProportionally(item.lineTaxPaise, [1, 1])
    return {
      description: item.title,
      hsnCode: item.hsnCode,
      qty: item.qty,
      unitPricePaise: item.unitPricePaise,
      taxableValuePaise,
      gstRatePercent: item.gstRatePercent,
      cgstRatePercent: halfRate,
      cgstPaise: cgstPaise ?? 0,
      sgstRatePercent: halfRate,
      sgstPaise: sgstPaise ?? 0,
      igstRatePercent: 0,
      igstPaise: 0,
      lineTotalPaise: item.lineTotalPaise,
    }
  })
}
