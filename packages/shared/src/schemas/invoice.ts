import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import {
  creditNoteIdSchema,
  invoiceIdSchema,
  orderIdSchema,
  returnIdSchema,
  sellerIdSchema,
  subOrderIdSchema,
  userIdSchema,
} from '../ids'
import { gstinSchema, hsnSchema } from '../validators/indian'
import { gstRatePercentSchema } from './catalogPart'
import { addressSnapshotSchema, epochMsSchema, stateCodeSchema } from './common'

/**
 * A composition-scheme seller (schemas/seller.ts's `gstComposition`) issues
 * a Bill of Supply, never a Tax Invoice — no tax rate/amount is legally
 * disclosable on that document at all (Sec 10 CGST Act).
 */
export const invoiceDocTypeSchema = z.enum(['tax_invoice', 'bill_of_supply'])
export type InvoiceDocType = z.infer<typeof invoiceDocTypeSchema>

export const invoiceLineSchema = z.object({
  description: z.string().min(1),
  hsnCode: hsnSchema,
  qty: z.number().int().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  taxableValuePaise: z.number().int().nonnegative(),
  /** Nominal catalog GST rate — always shown for reference even on a bill_of_supply line, where cgst/sgst/igst below are all zero. */
  gstRatePercent: gstRatePercentSchema,
  cgstRatePercent: z.number().nonnegative(),
  cgstPaise: z.number().int().nonnegative(),
  sgstRatePercent: z.number().nonnegative(),
  sgstPaise: z.number().int().nonnegative(),
  igstRatePercent: z.number().nonnegative(),
  igstPaise: z.number().int().nonnegative(),
  lineTotalPaise: z.number().int().nonnegative(),
})
export type InvoiceLine = z.infer<typeof invoiceLineSchema>

/** Point-in-time snapshot of the party shown on the invoice — never re-reads seller/buyer profile edits after the fact, same rationale as schemas/common.ts's addressSnapshotSchema. */
export const invoicePartySnapshotSchema = z.object({
  legalName: z.string().min(1),
  gstin: gstinSchema.optional(),
  address: addressSnapshotSchema,
})
export type InvoicePartySnapshot = z.infer<typeof invoicePartySnapshotSchema>

const invoiceMoneySchema = z.object({
  taxableValuePaise: z.number().int().nonnegative(),
  cgstPaise: z.number().int().nonnegative(),
  sgstPaise: z.number().int().nonnegative(),
  igstPaise: z.number().int().nonnegative(),
  shippingPaise: z.number().int().nonnegative(),
  totalPaise: z.number().int().nonnegative(),
})

export const invoiceSchema = z.object({
  id: invoiceIdSchema,
  /** SELLERCODE/FY26-27/000123 — sequential per seller per financial year, allocated inside a Firestore transaction on invoiceCounters/{sellerId}_{financialYear}. See functions/src/tax/invoiceNumbering.ts. Immutable once issued. */
  invoiceNumber: z.string().min(1),
  docType: invoiceDocTypeSchema,
  orderId: orderIdSchema,
  subOrderId: subOrderIdSchema,
  sellerId: sellerIdSchema,
  buyerId: userIdSchema,
  seller: invoicePartySnapshotSchema,
  buyer: invoicePartySnapshotSchema,
  placeOfSupplyStateCode: stateCodeSchema,
  isInterState: z.boolean(),
  lines: z.array(invoiceLineSchema).min(1),
  ...invoiceMoneySchema.shape,
  amountInWords: z.string().min(1),
  /** Storage object path (not the signed URL — that's minted fresh on read, see getInvoiceUrl.ts) at `sellers/{sellerId}/invoices/{invoiceId}.pdf`. Non-guessable only via the storage.rules gate on that prefix, not via path obscurity. */
  storagePath: z.string().min(1),
  pdfGeneratedAt: epochMsSchema,
  /** "FY26-27" — the financial year this invoice's number was allocated in, denormalised for report queries so GSTR-1/TCS reports don't need to re-derive it from placedAt on every row. */
  financialYear: z.string().min(1),
  invoiceDate: epochMsSchema,
  createdAt: epochMsSchema,
})
export type Invoice = z.infer<typeof invoiceSchema>
export const invoiceConverter = makeFirestoreConverter(invoiceSchema)

export const creditNoteReasonSchema = z.enum(['return', 'cancellation'])
export type CreditNoteReason = z.infer<typeof creditNoteReasonSchema>

export const creditNoteSchema = z.object({
  id: creditNoteIdSchema,
  /** SELLERCODE/CN-FY26-27/000045 — its own sequence, independent of the invoice sequence. See functions/src/tax/invoiceNumbering.ts. */
  creditNoteNumber: z.string().min(1),
  originalInvoiceId: invoiceIdSchema,
  originalInvoiceNumber: z.string().min(1),
  docType: invoiceDocTypeSchema,
  orderId: orderIdSchema,
  subOrderId: subOrderIdSchema,
  sellerId: sellerIdSchema,
  buyerId: userIdSchema,
  returnId: returnIdSchema.optional(),
  reason: creditNoteReasonSchema,
  seller: invoicePartySnapshotSchema,
  buyer: invoicePartySnapshotSchema,
  placeOfSupplyStateCode: stateCodeSchema,
  isInterState: z.boolean(),
  lines: z.array(invoiceLineSchema).min(1),
  ...invoiceMoneySchema.shape,
  amountInWords: z.string().min(1),
  storagePath: z.string().min(1),
  pdfGeneratedAt: epochMsSchema,
  financialYear: z.string().min(1),
  creditNoteDate: epochMsSchema,
  createdAt: epochMsSchema,
})
export type CreditNote = z.infer<typeof creditNoteSchema>
export const creditNoteConverter = makeFirestoreConverter(creditNoteSchema)

// ---------------------------------------------------------------------------
// getInvoiceUrl / getCreditNoteUrl callables
// ---------------------------------------------------------------------------

export const getInvoiceUrlRequestSchema = z.object({
  subOrderId: subOrderIdSchema,
})
export type GetInvoiceUrlRequest = z.infer<typeof getInvoiceUrlRequestSchema>

export const getInvoiceUrlResultSchema = z.object({
  invoiceId: invoiceIdSchema,
  invoiceNumber: z.string(),
  invoiceUrl: z.string().url(),
})
export type GetInvoiceUrlResult = z.infer<typeof getInvoiceUrlResultSchema>

export const getCreditNoteUrlRequestSchema = z.object({
  creditNoteId: creditNoteIdSchema,
})
export type GetCreditNoteUrlRequest = z.infer<typeof getCreditNoteUrlRequestSchema>

export const getCreditNoteUrlResultSchema = z.object({
  creditNoteId: creditNoteIdSchema,
  creditNoteNumber: z.string(),
  creditNoteUrl: z.string().url(),
})
export type GetCreditNoteUrlResult = z.infer<typeof getCreditNoteUrlResultSchema>
