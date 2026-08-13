import {
  computeTcs,
  getGmvTaxReportRequestSchema,
  type GetGmvTaxReportResult,
  getMonthBounds,
  invoiceSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../../orders/authz.js'
import { getTaxConfig } from '../taxConfig.js'
import { paiseToRupeesString, toCsv } from './csv.js'

/** Marketplace-wide (or one seller's) GMV + tax collected for one calendar month (design brief item 7) — GMV is the sum of invoiced subOrder totals, i.e. shipped orders, not merely placed ones (an unshipped/cancelled order was never fulfilled and was never invoiced). */
export const getGmvTaxReport = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<GetGmvTaxReportResult> => {
  if (!isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
  const parsed = getGmvTaxReportRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid month (YYYY-MM) is required')

  const { startMs, endMs } = getMonthBounds(parsed.data.month)
  const db = getFirestore()
  const taxConfig = await getTaxConfig()

  let query = db.collection('invoices').where('invoiceDate', '>=', startMs).where('invoiceDate', '<', endMs)
  if (parsed.data.sellerId) query = query.where('sellerId', '==', parsed.data.sellerId)
  const snapshot = await query.get()

  let subOrderCount = 0
  let gmvPaise = 0
  let taxableValuePaise = 0
  let cgstPaise = 0
  let sgstPaise = 0
  let igstPaise = 0
  let tcsPaise = 0

  for (const doc of snapshot.docs) {
    const invoice = invoiceSchema.safeParse({ id: doc.id, ...doc.data() })
    if (!invoice.success) continue
    subOrderCount += 1
    gmvPaise += invoice.data.totalPaise
    taxableValuePaise += invoice.data.taxableValuePaise
    cgstPaise += invoice.data.cgstPaise
    sgstPaise += invoice.data.sgstPaise
    igstPaise += invoice.data.igstPaise
    tcsPaise += computeTcs(invoice.data.taxableValuePaise, invoice.data.isInterState, taxConfig).totalPaise
  }

  const csv = toCsv(
    ['Month', 'SubOrders', 'GMV', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'TCS'],
    [[
      parsed.data.month,
      subOrderCount,
      paiseToRupeesString(gmvPaise),
      paiseToRupeesString(taxableValuePaise),
      paiseToRupeesString(cgstPaise),
      paiseToRupeesString(sgstPaise),
      paiseToRupeesString(igstPaise),
      paiseToRupeesString(tcsPaise),
    ]],
  )

  return { month: parsed.data.month, subOrderCount, gmvPaise, taxableValuePaise, cgstPaise, sgstPaise, igstPaise, tcsPaise, csv }
})
