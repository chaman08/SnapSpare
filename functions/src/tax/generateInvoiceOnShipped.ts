import {
  addressSnapshotSchema,
  amountInWordsFromPaise,
  computeTcs,
  computeTds,
  getFinancialYearLabel,
  type Invoice,
  invoiceSchema,
  type InvoicePartySnapshot,
  orderSchema,
  requiresEwayBill,
  sellerSchema,
  subOrderSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { buildInvoiceLinesFromSubOrder } from './buildInvoiceLines.js'
import { buildEwayBillPayload } from './ewayBill/buildEwayBillPayload.js'
import { commitFyGrossSales, readFyGrossSales } from './fySalesCounter.js'
import { commitSequence, formatDocumentNumber, readNextSequence, resolveSellerInvoiceCode } from './invoiceNumbering.js'
import { postLedgerEntries, readLedger } from './ledger.js'
import { renderTaxDocumentPdf } from './pdf/renderTaxDocumentPdf.js'
import { resolveSellerInvoiceAddress } from './resolveSellerInvoiceParty.js'
import { getTaxConfig } from './taxConfig.js'

const INVOICE_URL_TTL_MS = 30 * 24 * 60 * 60_000

/**
 * Fires on every subOrder write; generates the GST invoice exactly once, the
 * moment `status` transitions to `shipped` (design brief item 1). Guarded
 * three ways against duplicate generation: the before/after status-edge
 * check here, a fresh re-read + `invoiceNumber` check inside the
 * transaction (Firestore may replay a trigger), and the transactional
 * invoice-number counter itself (functions/src/tax/invoiceNumbering.ts),
 * which can never hand out the same number twice even under a genuine race.
 *
 * Split into two phases, same shape as shipping/generateShippingLabel.ts:
 * a transaction does everything that must be atomic (number allocation,
 * ledger postings, the Invoice doc, the subOrder's `invoiceNumber` field),
 * then — once that's safely committed — the PDF is rendered and uploaded to
 * Storage as a best-effort follow-up (network calls to a different service
 * don't belong inside a Firestore transaction). If the upload fails, the
 * invoice record/numbering/ledger entries are still correct and durable;
 * getInvoiceUrl.ts regenerates the PDF on demand from the Invoice doc, so a
 * failed upload here just means the buyer's first "Download invoice" click
 * takes the regeneration path instead of hitting a warm URL.
 */
export const generateInvoiceOnShipped = onDocumentWritten(
  { document: 'subOrders/{subOrderId}', region: 'asia-south1' },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : undefined
    const after = event.data?.after.exists ? event.data.after.data() : undefined
    if (!after || before?.status === 'shipped' || after.status !== 'shipped' || after.invoiceNumber) return

    const subOrderId = event.params.subOrderId as string
    const db = getFirestore()

    const [orderSnapshot, sellerSnapshot] = await Promise.all([
      db.collection('orders').doc(after.orderId as string).get(),
      db.collection('sellers').doc(after.sellerId as string).get(),
    ])
    if (!orderSnapshot.exists || !sellerSnapshot.exists) {
      logger.error('generateInvoiceOnShipped: order or seller missing', { subOrderId })
      return
    }
    const order = orderSchema.parse({ id: orderSnapshot.id, ...orderSnapshot.data() })
    const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })

    const sellerAddress = await resolveSellerInvoiceAddress(seller)
    if (!sellerAddress) {
      logger.error('generateInvoiceOnShipped: seller has no resolvable warehouse address, cannot invoice', {
        subOrderId,
        sellerId: seller.id,
      })
      return
    }

    const taxConfig = await getTaxConfig()
    const now = Date.now()
    const financialYear = getFinancialYearLabel(now)
    const sellerCode = resolveSellerInvoiceCode(seller)
    const docType = seller.gstComposition ? 'bill_of_supply' : 'tax_invoice'

    const sellerParty: InvoicePartySnapshot = { legalName: seller.legalName, gstin: seller.gstin, address: sellerAddress }
    // Place of supply is always the delivery (shipping) address per design
    // brief item 2, even when a distinct billing address/GSTIN is shown on
    // the invoice's "Billed To" panel below — GST's default place-of-supply
    // rule for goods is where they're delivered, not who's billed.
    const shippingAddress = addressSnapshotSchema.parse(after.shippingAddress)
    const buyerAddress = addressSnapshotSchema.parse(order.billingAddress ?? after.shippingAddress)
    const buyerParty: InvoicePartySnapshot = {
      legalName: order.billingLegalName ?? buyerAddress.contactName,
      // Omitted entirely (not set to undefined) when the buyer isn't a
      // business purchase — this object is embedded, unstripped, straight
      // into a Firestore write below, and an explicit `gstin: undefined`
      // nested inside it crashes that write the same way it would at the
      // top level (see createOrder.ts's toSubOrderItem for the same fix).
      ...(order.billingGstin ? { gstin: order.billingGstin } : {}),
      address: buyerAddress,
    }

    const invoiceRef = db.collection('invoices').doc()
    const ewayBillTaskRef = db.collection('ewayBillTasks').doc()

    try {
      const invoice = await db.runTransaction(async (tx) => {
        // ---- reads ----
        const subOrderRef = db.collection('subOrders').doc(subOrderId)
        const subOrderSnapshot = await tx.get(subOrderRef)
        if (!subOrderSnapshot.exists) throw new Error('subOrder_missing')
        const subOrder = subOrderSchema.parse({ id: subOrderSnapshot.id, ...subOrderSnapshot.data() })
        if (subOrder.status !== 'shipped' || subOrder.invoiceNumber) {
          // Already invoiced (retried trigger) or status moved on already — nothing to do.
          return undefined
        }

        const pendingSequence = await readNextSequence(tx, db, 'invoice', seller.id, financialYear)
        const ledgerRead = await readLedger(tx, db, seller.id)
        const fyGrossSales = await readFyGrossSales(tx, db, seller.id, financialYear)

        // ---- pure computation ----
        const invoiceNumber = formatDocumentNumber('invoice', sellerCode, financialYear, pendingSequence.sequence)
        const lines = buildInvoiceLinesFromSubOrder(subOrder.items, subOrder.isInterState)
        const taxableValuePaise = subOrder.subtotalPaise - subOrder.discountPaise
        const totalPaise = subOrder.totalPaise
        const amountInWords = amountInWordsFromPaise(totalPaise)
        const storagePath = `sellers/${seller.id}/invoices/${invoiceRef.id}.pdf`

        const tcs = computeTcs(taxableValuePaise, subOrder.isInterState, taxConfig)
        const tdsPaise = computeTds(
          {
            grossSaleExGstPaise: taxableValuePaise,
            cumulativeFyGrossSaleExGstPaise: fyGrossSales.cumulativeBeforePaise,
            sellerBusinessType: seller.businessType,
          },
          taxConfig,
        )

        const invoiceDoc: Omit<Invoice, 'id'> = {
          invoiceNumber,
          docType,
          orderId: order.id,
          subOrderId: subOrder.id,
          sellerId: seller.id,
          buyerId: subOrder.buyerId,
          seller: sellerParty,
          buyer: buyerParty,
          placeOfSupplyStateCode: shippingAddress.stateCode,
          isInterState: subOrder.isInterState,
          lines,
          taxableValuePaise,
          cgstPaise: subOrder.cgstPaise,
          sgstPaise: subOrder.sgstPaise,
          igstPaise: subOrder.igstPaise,
          shippingPaise: subOrder.shippingPaise,
          totalPaise,
          amountInWords,
          storagePath,
          pdfGeneratedAt: now,
          financialYear,
          invoiceDate: now,
          createdAt: now,
        }
        invoiceSchema.parse({ id: invoiceRef.id, ...invoiceDoc })

        // ---- writes ----
        commitSequence(tx, pendingSequence, seller.id, financialYear, now)
        commitFyGrossSales(tx, fyGrossSales, seller.id, financialYear, taxableValuePaise, now)
        postLedgerEntries(
          tx,
          db,
          ledgerRead,
          seller.id,
          [
            {
              type: 'tcs_debit',
              direction: 'debit',
              amountPaise: tcs.totalPaise,
              referenceType: 'invoice',
              referenceId: invoiceRef.id,
              description: `TCS on ${invoiceNumber}`,
            },
            {
              type: 'tds_debit',
              direction: 'debit',
              amountPaise: tdsPaise,
              referenceType: 'invoice',
              referenceId: invoiceRef.id,
              description: `TDS on ${invoiceNumber}`,
            },
          ],
          now,
        )
        tx.set(invoiceRef, invoiceDoc)

        if (requiresEwayBill(totalPaise, taxConfig)) {
          const payload = buildEwayBillPayload({
            invoiceNumber,
            invoiceDate: now,
            seller: sellerParty,
            buyer: buyerParty,
            lines,
            cgstPaise: subOrder.cgstPaise,
            sgstPaise: subOrder.sgstPaise,
            igstPaise: subOrder.igstPaise,
            totalPaise,
          })
          tx.set(ewayBillTaskRef, {
            orderId: order.id,
            subOrderId: subOrder.id,
            invoiceId: invoiceRef.id,
            sellerId: seller.id,
            buyerId: subOrder.buyerId,
            consignmentValuePaise: totalPaise,
            status: 'pending',
            payload,
            createdAt: now,
            updatedAt: now,
          })
        }

        tx.update(subOrderRef, { invoiceId: invoiceRef.id, invoiceNumber, updatedAt: now })

        return { id: invoiceRef.id, ...invoiceDoc }
      })

      if (!invoice) return // already invoiced / status moved on — see the transaction's early-return above

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

      await db.collection('subOrders').doc(subOrderId).update({ invoiceUrl, updatedAt: Date.now() })
    } catch (error) {
      logger.error('generateInvoiceOnShipped: failed', {
        subOrderId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },
)
