import {
  computeTcs,
  creditNoteSchema,
  getMonthBounds,
  type GetTcsSummaryResult,
  getTcsSummaryRequestSchema,
  invoiceSchema,
  type TcsSummaryRow,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../../orders/authz.js'
import { getTaxConfig } from '../taxConfig.js'
import { paiseToRupeesString, toCsv } from './csv.js'

interface SellerTotals {
  sellerId: string
  sellerLegalName: string
  sellerGstin: string
  netTaxableSuppliesPaise: number
  tcsCgstPaise: number
  tcsSgstPaise: number
  tcsIgstPaise: number
}

/**
 * Net taxable supplies + TCS withheld per seller for one calendar month —
 * the input a seller (or the platform, filing on their behalf) needs for
 * GSTR-8 reconciliation (design brief item 3). Recomputed from invoices/
 * credit notes at the *current* configured TCS rate (config/tax) rather
 * than re-reading the ledger's historical entries — acceptable since the
 * rate rarely changes, but flagged here (and in the README) as something to
 * revisit with a chartered accountant if config/tax's rate is ever changed
 * mid-year: a report re-run after a rate change would restate prior months
 * at the new rate, not the rate actually withheld at the time.
 */
export const getTcsSummaryReport = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<GetTcsSummaryResult> => {
  if (!isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
  const parsed = getTcsSummaryRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid month (YYYY-MM) is required')

  const { startMs, endMs } = getMonthBounds(parsed.data.month)
  const db = getFirestore()
  const taxConfig = await getTaxConfig()

  let invoiceQuery = db.collection('invoices').where('invoiceDate', '>=', startMs).where('invoiceDate', '<', endMs)
  if (parsed.data.sellerId) invoiceQuery = invoiceQuery.where('sellerId', '==', parsed.data.sellerId)
  let creditNoteQuery = db.collection('creditNotes').where('creditNoteDate', '>=', startMs).where('creditNoteDate', '<', endMs)
  if (parsed.data.sellerId) creditNoteQuery = creditNoteQuery.where('sellerId', '==', parsed.data.sellerId)

  const [invoiceSnapshot, creditNoteSnapshot] = await Promise.all([invoiceQuery.get(), creditNoteQuery.get()])

  const totals = new Map<string, SellerTotals>()
  function bucketFor(sellerId: string, sellerLegalName: string, sellerGstin: string): SellerTotals {
    const existing = totals.get(sellerId)
    if (existing) return existing
    const created: SellerTotals = {
      sellerId,
      sellerLegalName,
      sellerGstin,
      netTaxableSuppliesPaise: 0,
      tcsCgstPaise: 0,
      tcsSgstPaise: 0,
      tcsIgstPaise: 0,
    }
    totals.set(sellerId, created)
    return created
  }

  for (const doc of invoiceSnapshot.docs) {
    const invoice = invoiceSchema.safeParse({ id: doc.id, ...doc.data() })
    if (!invoice.success) continue
    const bucket = bucketFor(invoice.data.sellerId, invoice.data.seller.legalName, invoice.data.seller.gstin ?? '')
    const tcs = computeTcs(invoice.data.taxableValuePaise, invoice.data.isInterState, taxConfig)
    bucket.netTaxableSuppliesPaise += invoice.data.taxableValuePaise
    bucket.tcsCgstPaise += tcs.cgstPaise
    bucket.tcsSgstPaise += tcs.sgstPaise
    bucket.tcsIgstPaise += tcs.igstPaise
  }

  for (const doc of creditNoteSnapshot.docs) {
    const creditNote = creditNoteSchema.safeParse({ id: doc.id, ...doc.data() })
    if (!creditNote.success) continue
    const bucket = bucketFor(creditNote.data.sellerId, creditNote.data.seller.legalName, creditNote.data.seller.gstin ?? '')
    const tcs = computeTcs(creditNote.data.taxableValuePaise, creditNote.data.isInterState, taxConfig)
    bucket.netTaxableSuppliesPaise -= creditNote.data.taxableValuePaise
    bucket.tcsCgstPaise -= tcs.cgstPaise
    bucket.tcsSgstPaise -= tcs.sgstPaise
    bucket.tcsIgstPaise -= tcs.igstPaise
  }

  const rows: TcsSummaryRow[] = Array.from(totals.values())
    .map((bucket) => ({
      sellerId: bucket.sellerId,
      sellerLegalName: bucket.sellerLegalName,
      sellerGstin: bucket.sellerGstin,
      netTaxableSuppliesPaise: bucket.netTaxableSuppliesPaise,
      tcsCgstPaise: bucket.tcsCgstPaise,
      tcsSgstPaise: bucket.tcsSgstPaise,
      tcsIgstPaise: bucket.tcsIgstPaise,
      tcsTotalPaise: bucket.tcsCgstPaise + bucket.tcsSgstPaise + bucket.tcsIgstPaise,
    }))
    .sort((a, b) => a.sellerLegalName.localeCompare(b.sellerLegalName))

  const csv = toCsv(
    ['Seller', 'GSTIN', 'Net Taxable Supplies', 'TCS CGST', 'TCS SGST', 'TCS IGST', 'TCS Total'],
    rows.map((row) => [
      row.sellerLegalName,
      row.sellerGstin,
      paiseToRupeesString(row.netTaxableSuppliesPaise),
      paiseToRupeesString(row.tcsCgstPaise),
      paiseToRupeesString(row.tcsSgstPaise),
      paiseToRupeesString(row.tcsIgstPaise),
      paiseToRupeesString(row.tcsTotalPaise),
    ]),
  )

  return { month: parsed.data.month, rows, csv }
})
