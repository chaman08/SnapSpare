import type { EwayBillPayload, InvoiceLine, InvoicePartySnapshot } from '@snapspare/shared'
import { formatDateDDMMYYYY } from '@snapspare/shared'

export interface BuildEwayBillPayloadInput {
  invoiceNumber: string
  invoiceDate: number
  seller: InvoicePartySnapshot
  buyer: InvoicePartySnapshot
  lines: InvoiceLine[]
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  totalPaise: number
}

/** Rupees, not paise — the NIC schema's `*Value`/`taxableAmount` fields are decimal rupee amounts. */
function toRupees(paise: number): number {
  return Math.round(paise) / 100
}

/**
 * Builds the NIC e-way bill JSON payload (EWB_INV01 shape) for a shipment
 * whose consignment value has crossed the configured threshold — see
 * pricing/tax.ts's `requiresEwayBill` and generateInvoiceOnShipped.ts,
 * which calls this once per invoiced subOrder. Transporter/vehicle fields
 * (transporterId, vehicleNo, ...) are deliberately absent — this phase has
 * no dispatch/transporter-assignment step to source them from; a seller
 * filing this manually fills those in on the GST portal, and a future
 * direct API integration (see ewayBill/provider.ts) would add them once
 * that data exists in this system.
 */
export function buildEwayBillPayload(input: BuildEwayBillPayloadInput): EwayBillPayload {
  return {
    supplyType: 'O',
    subSupplyType: '1',
    docType: 'INV',
    docNo: input.invoiceNumber,
    docDate: formatDateDDMMYYYY(input.invoiceDate),
    fromGstin: input.seller.gstin ?? '',
    fromTrdName: input.seller.legalName,
    fromAddr1: input.seller.address.line1,
    fromPlace: input.seller.address.city,
    fromPincode: input.seller.address.pincode,
    fromStateCode: input.seller.address.stateCode,
    toGstin: input.buyer.gstin,
    toTrdName: input.buyer.legalName,
    toAddr1: input.buyer.address.line1,
    toPlace: input.buyer.address.city,
    toPincode: input.buyer.address.pincode,
    toStateCode: input.buyer.address.stateCode,
    transactionType: 1,
    totalValue: toRupees(input.lines.reduce((sum, line) => sum + line.taxableValuePaise, 0)),
    cgstValue: toRupees(input.cgstPaise),
    sgstValue: toRupees(input.sgstPaise),
    igstValue: toRupees(input.igstPaise),
    totInvValue: toRupees(input.totalPaise),
    itemList: input.lines.map((line) => ({
      productName: line.description,
      hsnCode: line.hsnCode,
      quantity: line.qty,
      qtyUnit: 'NOS',
      taxableAmount: toRupees(line.taxableValuePaise),
      cgstRate: line.cgstRatePercent,
      sgstRate: line.sgstRatePercent,
      igstRate: line.igstRatePercent,
    })),
  }
}
