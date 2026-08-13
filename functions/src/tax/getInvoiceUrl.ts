import { type GetInvoiceUrlResult, getInvoiceUrlRequestSchema, invoiceSchema, subOrderSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { renderTaxDocumentPdf } from './pdf/renderTaxDocumentPdf.js'

const INVOICE_URL_TTL_MS = 30 * 24 * 60 * 60_000

/**
 * Mints a fresh signed read URL for a subOrder's GST invoice — the
 * sanctioned access path (design brief item 1: "expose via a signed URL
 * through a callable that checks the requester is the buyer, the seller or
 * an admin"). Regenerates the PDF from the immutable Invoice Firestore doc
 * and re-uploads on every call rather than trusting whatever's already at
 * `storagePath` — same "regenerate is cheap, stay idempotent" rationale as
 * shipping/generateShippingLabel.ts, and it's what makes
 * generateInvoiceOnShipped.ts's best-effort PDF upload safe to fail: a
 * buyer's first "Download invoice" click just does the upload here instead.
 */
export const getInvoiceUrl = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<GetInvoiceUrlResult> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const parsed = getInvoiceUrlRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid subOrderId is required')

  const db = getFirestore()
  const subOrderSnapshot = await db.collection('subOrders').doc(parsed.data.subOrderId).get()
  if (!subOrderSnapshot.exists) throw new HttpsError('not-found', 'subOrder_not_found')
  const subOrder = subOrderSchema.parse({ id: subOrderSnapshot.id, ...subOrderSnapshot.data() })
  if (!subOrder.invoiceId) throw new HttpsError('failed-precondition', 'invoice_not_generated')

  const uid = request.auth.uid
  const sellerId = request.auth.token.sellerId as string | undefined
  const isBuyer = subOrder.buyerId === uid
  const isSeller = sellerId !== undefined && subOrder.sellerId === sellerId
  const admin = isAdminRequest(request)
  if (!isBuyer && !isSeller && !admin) throw new HttpsError('permission-denied', 'not_a_participant')

  const invoiceSnapshot = await db.collection('invoices').doc(subOrder.invoiceId).get()
  if (!invoiceSnapshot.exists) throw new HttpsError('not-found', 'invoice_not_found')
  const invoice = invoiceSchema.parse({ id: invoiceSnapshot.id, ...invoiceSnapshot.data() })

  const pdfBytes = await renderTaxDocumentPdf({
    title: invoice.docType === 'bill_of_supply' ? 'BILL OF SUPPLY' : 'TAX INVOICE',
    documentNumber: invoice.invoiceNumber,
    documentDate: invoice.invoiceDate,
    seller: invoice.seller,
    buyer: invoice.buyer,
    placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
    isInterState: invoice.isInterState,
    lines: invoice.lines,
    taxableValuePaise: invoice.taxableValuePaise,
    cgstPaise: invoice.cgstPaise,
    sgstPaise: invoice.sgstPaise,
    igstPaise: invoice.igstPaise,
    shippingPaise: invoice.shippingPaise,
    totalPaise: invoice.totalPaise,
    amountInWords: invoice.amountInWords,
  })

  const file = getStorage().bucket().file(invoice.storagePath)
  await file.save(pdfBytes, { contentType: 'application/pdf' })
  const [invoiceUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + INVOICE_URL_TTL_MS })

  await subOrderSnapshot.ref.update({ invoiceUrl, updatedAt: Date.now() })

  return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, invoiceUrl }
})
