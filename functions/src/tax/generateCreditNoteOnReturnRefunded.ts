import {
  amountInWordsFromPaise,
  computeTcs,
  computeTds,
  type CreditNote,
  creditNoteSchema,
  getFinancialYearLabel,
  invoiceSchema,
  returnSchema,
  sellerSchema,
  subOrderSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { scaleInvoiceLineForReturn } from './buildInvoiceLines.js'
import { commitFyGrossSales, readFyGrossSales } from './fySalesCounter.js'
import { commitSequence, formatDocumentNumber, readNextSequence, resolveSellerInvoiceCode } from './invoiceNumbering.js'
import { postLedgerEntries, readLedger } from './ledger.js'
import { renderTaxDocumentPdf } from './pdf/renderTaxDocumentPdf.js'
import { getTaxConfig } from './taxConfig.js'

/**
 * Fires when a return reaches `refunded` (refundReturn.ts's terminal write)
 * and issues a GST credit note against the original invoice — design brief
 * item 5. Same two-phase shape as generateInvoiceOnShipped.ts: a
 * transaction allocates the credit note's own sequence, reverses the
 * proportional TCS/TDS previously posted for the returned line, and writes
 * the CreditNote doc + `returns.creditNoteId`; the PDF render/upload
 * happens as a best-effort follow-up.
 *
 * subOrder cancellation never reaches this path — CANCELLABLE_SUB_ORDER_STATUSES
 * (orders/cancelSubOrder.ts) only covers {pending, accepted, packed}, all
 * strictly before an invoice exists, so "credit notes on returns and
 * cancellations" (design brief item 5) reduces to "returns" in practice;
 * nothing in this codebase can cancel an already-invoiced subOrder today.
 */
export const generateCreditNoteOnReturnRefunded = onDocumentWritten(
  { document: 'returns/{returnId}', region: 'asia-south1' },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : undefined
    const after = event.data?.after.exists ? event.data.after.data() : undefined
    if (!after || before?.status === 'refunded' || after.status !== 'refunded' || after.creditNoteId) return

    const returnId = event.params.returnId as string
    const db = getFirestore()
    const ret = returnSchema.parse({ id: returnId, ...after })

    const subOrderSnapshotOuter = await db.collection('subOrders').doc(ret.subOrderId).get()
    if (!subOrderSnapshotOuter.exists) {
      logger.error('generateCreditNoteOnReturnRefunded: subOrder missing', { returnId })
      return
    }
    const subOrderOuter = subOrderSchema.parse({ id: subOrderSnapshotOuter.id, ...subOrderSnapshotOuter.data() })
    if (!subOrderOuter.invoiceId) {
      logger.error('generateCreditNoteOnReturnRefunded: subOrder has no invoice, cannot credit-note', { returnId })
      return
    }

    const invoiceSnapshot = await db.collection('invoices').doc(subOrderOuter.invoiceId).get()
    const sellerSnapshot = await db.collection('sellers').doc(ret.sellerId).get()
    if (!invoiceSnapshot.exists || !sellerSnapshot.exists) {
      logger.error('generateCreditNoteOnReturnRefunded: invoice or seller missing', { returnId })
      return
    }
    const originalInvoice = invoiceSchema.parse({ id: invoiceSnapshot.id, ...invoiceSnapshot.data() })
    const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })

    // Invoice lines are built from subOrder.items in the same order (see
    // buildInvoiceLinesFromSubOrder), so the item's array index is also its
    // invoice-line index — more reliable than matching on description/HSN,
    // which two distinct listings could share.
    const itemIndex = subOrderOuter.items.findIndex((line) => line.listingId === ret.listingId)
    const item = itemIndex >= 0 ? subOrderOuter.items[itemIndex] : undefined
    const invoiceLine = itemIndex >= 0 ? originalInvoice.lines[itemIndex] : undefined
    if (!item || !invoiceLine) {
      logger.error('generateCreditNoteOnReturnRefunded: matching invoice line not found', { returnId })
      return
    }

    const taxConfig = await getTaxConfig()
    const now = Date.now()
    const financialYear = getFinancialYearLabel(now)
    const sellerCode = resolveSellerInvoiceCode(seller)
    const creditNoteLine = scaleInvoiceLineForReturn(invoiceLine, ret.qty, item.qty)
    const creditNoteRef = db.collection('creditNotes').doc()

    try {
      const creditNote = await db.runTransaction(async (tx) => {
        const returnRef = db.collection('returns').doc(returnId)
        const returnSnapshot = await tx.get(returnRef)
        if (!returnSnapshot.exists) throw new Error('return_missing')
        const freshReturn = returnSchema.parse({ id: returnSnapshot.id, ...returnSnapshot.data() })
        if (freshReturn.status !== 'refunded' || freshReturn.creditNoteId) return undefined

        const pendingSequence = await readNextSequence(tx, db, 'creditNote', seller.id, financialYear)
        const ledgerRead = await readLedger(tx, db, seller.id)
        const fyGrossSales = await readFyGrossSales(tx, db, seller.id, financialYear)

        const creditNoteNumber = formatDocumentNumber('creditNote', sellerCode, financialYear, pendingSequence.sequence)
        const totalPaise = creditNoteLine.lineTotalPaise
        const amountInWords = amountInWordsFromPaise(totalPaise)
        const storagePath = `sellers/${seller.id}/creditNotes/${creditNoteRef.id}.pdf`

        // Proportional reversal of the TCS/TDS originally withheld for this
        // line — a simplification (does not re-run 194-O's threshold-crossing
        // logic against the *current* cumulative FY total, which a partial
        // credit note issued in a different financial year than the original
        // sale would need); flagged for CA review alongside every other rate
        // in this phase, see README's compliance note.
        const tcsReversal = computeTcs(creditNoteLine.taxableValuePaise, originalInvoice.isInterState, taxConfig)
        const tdsReversalPaise = computeTds(
          {
            grossSaleExGstPaise: creditNoteLine.taxableValuePaise,
            cumulativeFyGrossSaleExGstPaise: Math.max(
              0,
              fyGrossSales.cumulativeBeforePaise - creditNoteLine.taxableValuePaise,
            ),
            sellerBusinessType: seller.businessType,
          },
          taxConfig,
        )

        const creditNoteDoc: Omit<CreditNote, 'id'> = {
          creditNoteNumber,
          originalInvoiceId: originalInvoice.id,
          originalInvoiceNumber: originalInvoice.invoiceNumber,
          docType: originalInvoice.docType,
          orderId: originalInvoice.orderId,
          subOrderId: originalInvoice.subOrderId,
          sellerId: seller.id,
          buyerId: originalInvoice.buyerId,
          returnId: freshReturn.id,
          reason: 'return',
          seller: originalInvoice.seller,
          buyer: originalInvoice.buyer,
          placeOfSupplyStateCode: originalInvoice.placeOfSupplyStateCode,
          isInterState: originalInvoice.isInterState,
          lines: [creditNoteLine],
          taxableValuePaise: creditNoteLine.taxableValuePaise,
          cgstPaise: creditNoteLine.cgstPaise,
          sgstPaise: creditNoteLine.sgstPaise,
          igstPaise: creditNoteLine.igstPaise,
          shippingPaise: 0,
          totalPaise,
          amountInWords,
          storagePath,
          pdfGeneratedAt: now,
          financialYear,
          creditNoteDate: now,
          createdAt: now,
        }
        creditNoteSchema.parse({ id: creditNoteRef.id, ...creditNoteDoc })

        commitSequence(tx, pendingSequence, seller.id, financialYear, now)
        commitFyGrossSales(tx, fyGrossSales, seller.id, financialYear, -creditNoteLine.taxableValuePaise, now)
        postLedgerEntries(
          tx,
          db,
          ledgerRead,
          seller.id,
          [
            {
              type: 'tcs_debit',
              direction: 'credit',
              amountPaise: tcsReversal.totalPaise,
              referenceType: 'creditNote',
              referenceId: creditNoteRef.id,
              description: `TCS reversal for ${creditNoteNumber}`,
            },
            {
              type: 'tds_debit',
              direction: 'credit',
              amountPaise: tdsReversalPaise,
              referenceType: 'creditNote',
              referenceId: creditNoteRef.id,
              description: `TDS reversal for ${creditNoteNumber}`,
            },
          ],
          now,
        )
        tx.set(creditNoteRef, creditNoteDoc)
        tx.update(returnRef, { creditNoteId: creditNoteRef.id, updatedAt: now })

        return { id: creditNoteRef.id, ...creditNoteDoc }
      })

      if (!creditNote) return

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
      // No signed URL is cached here — getCreditNoteUrl.ts mints one fresh
      // on demand (same rationale as generateInvoiceOnShipped.ts).
    } catch (error) {
      logger.error('generateCreditNoteOnReturnRefunded: failed', {
        returnId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },
)
