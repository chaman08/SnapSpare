import {
  type Gstr1SummaryRow,
  getGstr1SummaryRequestSchema,
  type GetGstr1SummaryResult,
  getMonthBounds,
  invoiceSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../../orders/authz.js'
import { paiseToRupeesString, toCsv } from './csv.js'

interface Bucket {
  sellerId: string
  sellerLegalName: string
  sellerGstin: string
  supplyType: 'b2b' | 'b2c'
  gstRatePercent: number
  invoiceIds: Set<string>
  taxableValuePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
}

/**
 * GSTR-1-adjacent outward-supply summary (design brief item 7): per seller,
 * B2B (buyer has a GSTIN) vs B2C, rate-wise taxable value + tax, for one
 * calendar month. Bucketed at invoice-*line* granularity (a single invoice
 * can carry more than one GST rate) but invoice-counted per unique invoice
 * within a bucket, matching how GSTR-1's own rate-wise summary works.
 */
export const getGstr1SummaryReport = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<GetGstr1SummaryResult> => {
  if (!isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
  const parsed = getGstr1SummaryRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid month (YYYY-MM) is required')

  const { startMs, endMs } = getMonthBounds(parsed.data.month)
  const db = getFirestore()
  let query = db.collection('invoices').where('invoiceDate', '>=', startMs).where('invoiceDate', '<', endMs)
  if (parsed.data.sellerId) query = query.where('sellerId', '==', parsed.data.sellerId)
  const snapshot = await query.get()

  const buckets = new Map<string, Bucket>()
  for (const doc of snapshot.docs) {
    const invoice = invoiceSchema.safeParse({ id: doc.id, ...doc.data() })
    if (!invoice.success) continue
    const supplyType: 'b2b' | 'b2c' = invoice.data.buyer.gstin ? 'b2b' : 'b2c'

    for (const line of invoice.data.lines) {
      const key = `${invoice.data.sellerId}|${supplyType}|${line.gstRatePercent}`
      const bucket = buckets.get(key) ?? {
        sellerId: invoice.data.sellerId,
        sellerLegalName: invoice.data.seller.legalName,
        sellerGstin: invoice.data.seller.gstin ?? '',
        supplyType,
        gstRatePercent: line.gstRatePercent,
        invoiceIds: new Set<string>(),
        taxableValuePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
      }
      bucket.invoiceIds.add(invoice.data.id)
      bucket.taxableValuePaise += line.taxableValuePaise
      bucket.cgstPaise += line.cgstPaise
      bucket.sgstPaise += line.sgstPaise
      bucket.igstPaise += line.igstPaise
      buckets.set(key, bucket)
    }
  }

  const rows: Gstr1SummaryRow[] = Array.from(buckets.values())
    .map((bucket) => ({
      sellerId: bucket.sellerId,
      sellerLegalName: bucket.sellerLegalName,
      sellerGstin: bucket.sellerGstin,
      supplyType: bucket.supplyType,
      gstRatePercent: bucket.gstRatePercent,
      invoiceCount: bucket.invoiceIds.size,
      taxableValuePaise: bucket.taxableValuePaise,
      cgstPaise: bucket.cgstPaise,
      sgstPaise: bucket.sgstPaise,
      igstPaise: bucket.igstPaise,
    }))
    .sort((a, b) => a.sellerLegalName.localeCompare(b.sellerLegalName) || a.gstRatePercent - b.gstRatePercent)

  const csv = toCsv(
    ['Seller', 'GSTIN', 'Supply Type', 'GST Rate %', 'Invoice Count', 'Taxable Value', 'CGST', 'SGST', 'IGST'],
    rows.map((row) => [
      row.sellerLegalName,
      row.sellerGstin,
      row.supplyType.toUpperCase(),
      row.gstRatePercent,
      row.invoiceCount,
      paiseToRupeesString(row.taxableValuePaise),
      paiseToRupeesString(row.cgstPaise),
      paiseToRupeesString(row.sgstPaise),
      paiseToRupeesString(row.igstPaise),
    ]),
  )

  return { month: parsed.data.month, rows, csv }
})
