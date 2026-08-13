import {
  creditNoteSchema,
  getFinancialQuarterBounds,
  type GetTdsSummaryResult,
  getTdsSummaryRequestSchema,
  invoiceSchema,
  sellerSchema,
  type TdsSummaryRow,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../../orders/authz.js'
import { paiseToRupeesString, toCsv } from './csv.js'

/**
 * Section 194-O TDS deducted per (resident) seller for one FY quarter
 * (design brief item 4's quarterly filing cadence). Reads the ledger's
 * `tds_debit` entries directly (collectionGroup query across every
 * seller's `ledgers/{sellerId}/entries`) rather than recomputing from
 * invoices — unlike TCS's flat rate, 194-O's individual/HUF exemption
 * threshold is cumulative and history-dependent (pricing/tax.ts's
 * computeTds), so the ledger's entries (posted with the correct threshold
 * state *at the time*) are the only accurate source; a report-time
 * recomputation would wrongly reset the threshold check to zero for every
 * period queried. A ledger doc's id is the sellerId (see
 * functions/src/tax/ledger.ts), so `ledgerId` on each entry doubles as the
 * seller id with no extra lookup.
 */
export const getTdsSummaryReport = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<GetTdsSummaryResult> => {
  if (!isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
  const parsed = getTdsSummaryRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid financialYear and quarter are required')

  const { startMs, endMs } = getFinancialQuarterBounds(parsed.data.financialYear, parsed.data.quarter)
  const db = getFirestore()

  let query = db
    .collectionGroup('entries')
    .where('type', '==', 'tds_debit')
    .where('createdAt', '>=', startMs)
    .where('createdAt', '<', endMs)
  if (parsed.data.sellerId) query = query.where('ledgerId', '==', parsed.data.sellerId)
  const snapshot = await query.get()

  const netBySellerId = new Map<string, number>()
  for (const doc of snapshot.docs) {
    const data = doc.data()
    const sellerId = data.ledgerId as string | undefined
    const amountPaise = data.amountPaise as number | undefined
    const direction = data.direction as 'credit' | 'debit' | undefined
    if (!sellerId || amountPaise === undefined || !direction) continue
    const signed = direction === 'debit' ? amountPaise : -amountPaise
    netBySellerId.set(sellerId, (netBySellerId.get(sellerId) ?? 0) + signed)
  }

  // Gross sale (ex-GST) per seller for the same quarter — the TDS base —
  // recomputed from invoices/credit notes rather than read off the ledger
  // (which only records the withheld amount, not the base it was withheld
  // on). Safe to recompute here (unlike the threshold-dependent TDS amount
  // itself): it's a plain sum, not something the individual/HUF exemption
  // threshold changes retroactively.
  let invoiceQuery = db.collection('invoices').where('invoiceDate', '>=', startMs).where('invoiceDate', '<', endMs)
  let creditNoteQuery = db.collection('creditNotes').where('creditNoteDate', '>=', startMs).where('creditNoteDate', '<', endMs)
  if (parsed.data.sellerId) {
    invoiceQuery = invoiceQuery.where('sellerId', '==', parsed.data.sellerId)
    creditNoteQuery = creditNoteQuery.where('sellerId', '==', parsed.data.sellerId)
  }
  const [invoiceSnapshot, creditNoteSnapshot] = await Promise.all([invoiceQuery.get(), creditNoteQuery.get()])

  const grossSaleBySellerId = new Map<string, number>()
  for (const doc of invoiceSnapshot.docs) {
    const invoice = invoiceSchema.safeParse({ id: doc.id, ...doc.data() })
    if (!invoice.success) continue
    grossSaleBySellerId.set(
      invoice.data.sellerId,
      (grossSaleBySellerId.get(invoice.data.sellerId) ?? 0) + invoice.data.taxableValuePaise,
    )
  }
  for (const doc of creditNoteSnapshot.docs) {
    const creditNote = creditNoteSchema.safeParse({ id: doc.id, ...doc.data() })
    if (!creditNote.success) continue
    grossSaleBySellerId.set(
      creditNote.data.sellerId,
      (grossSaleBySellerId.get(creditNote.data.sellerId) ?? 0) - creditNote.data.taxableValuePaise,
    )
  }

  const sellerIds = Array.from(new Set([...netBySellerId.keys(), ...grossSaleBySellerId.keys()]))
  const sellerSnapshots = await Promise.all(sellerIds.map((id) => db.collection('sellers').doc(id).get()))
  const rows: TdsSummaryRow[] = []
  sellerSnapshots.forEach((snap, index) => {
    const sellerId = sellerIds[index]
    if (!sellerId || !snap.exists) return
    const seller = sellerSchema.safeParse({ id: snap.id, ...snap.data() })
    if (!seller.success) return
    rows.push({
      sellerId,
      sellerLegalName: seller.data.legalName,
      sellerPan: seller.data.pan,
      grossSaleExGstPaise: grossSaleBySellerId.get(sellerId) ?? 0,
      tdsDeductedPaise: netBySellerId.get(sellerId) ?? 0,
    })
  })
  rows.sort((a, b) => a.sellerLegalName.localeCompare(b.sellerLegalName))

  const csv = toCsv(
    ['Seller', 'PAN', 'TDS Deducted'],
    rows.map((row) => [row.sellerLegalName, row.sellerPan, paiseToRupeesString(row.tdsDeductedPaise)]),
  )

  return { financialYear: parsed.data.financialYear, quarter: parsed.data.quarter, rows, csv }
})
