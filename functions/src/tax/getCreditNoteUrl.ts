import {
  creditNoteSchema,
  type GetCreditNoteUrlResult,
  getCreditNoteUrlRequestSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { renderTaxDocumentPdf } from './pdf/renderTaxDocumentPdf.js'

const CREDIT_NOTE_URL_TTL_MS = 30 * 24 * 60 * 60_000

/** Same shape as getInvoiceUrl.ts, for a credit note instead — see that file's doc comment. */
export const getCreditNoteUrl = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<GetCreditNoteUrlResult> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const parsed = getCreditNoteUrlRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid creditNoteId is required')

  const db = getFirestore()
  const snapshot = await db.collection('creditNotes').doc(parsed.data.creditNoteId).get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'credit_note_not_found')
  const creditNote = creditNoteSchema.parse({ id: snapshot.id, ...snapshot.data() })

  const uid = request.auth.uid
  const sellerId = request.auth.token.sellerId as string | undefined
  const isBuyer = creditNote.buyerId === uid
  const isSeller = sellerId !== undefined && creditNote.sellerId === sellerId
  const admin = isAdminRequest(request)
  if (!isBuyer && !isSeller && !admin) throw new HttpsError('permission-denied', 'not_a_participant')

  const pdfBytes = await renderTaxDocumentPdf({
    title: 'CREDIT NOTE',
    documentNumber: creditNote.creditNoteNumber,
    documentDate: creditNote.creditNoteDate,
    originalInvoiceNumber: creditNote.originalInvoiceNumber,
    seller: creditNote.seller,
    buyer: creditNote.buyer,
    placeOfSupplyStateCode: creditNote.placeOfSupplyStateCode,
    isInterState: creditNote.isInterState,
    lines: creditNote.lines,
    taxableValuePaise: creditNote.taxableValuePaise,
    cgstPaise: creditNote.cgstPaise,
    sgstPaise: creditNote.sgstPaise,
    igstPaise: creditNote.igstPaise,
    shippingPaise: creditNote.shippingPaise,
    totalPaise: creditNote.totalPaise,
    amountInWords: creditNote.amountInWords,
  })

  const file = getStorage().bucket().file(creditNote.storagePath)
  await file.save(pdfBytes, { contentType: 'application/pdf' })
  const [creditNoteUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + CREDIT_NOTE_URL_TTL_MS })

  return { creditNoteId: creditNote.id, creditNoteNumber: creditNote.creditNoteNumber, creditNoteUrl }
})
