import type { InvoiceLine, InvoicePartySnapshot } from '@snapspare/shared'
import { formatDateDDMMYYYY, formatINR, INDIAN_STATE_CODES } from '@snapspare/shared'
import PDFDocument from 'pdfkit'

/**
 * SnapSpare is an e-commerce marketplace facilitator (Sec 2(45) CGST Act),
 * never the supplier of record — every tax document must say so plainly so
 * it can't be mistaken for a SnapSpare-issued invoice. The legal entity
 * name below is a placeholder; wire it to config/app once the operating
 * company's registered name is finalized (see README's compliance note).
 */
const PLATFORM_LEGAL_NAME = 'SnapSpare Technologies Private Limited'
const PLATFORM_ROLE_NOTE =
  `This document is issued by the Seller named above. ${PLATFORM_LEGAL_NAME} operates ` +
  'the SnapSpare marketplace as an e-commerce operator under Section 2(45) of the CGST ' +
  'Act, 2017, and is not the supplier of the goods listed on this document.'

export type TaxDocumentTitle = 'TAX INVOICE' | 'BILL OF SUPPLY' | 'CREDIT NOTE'

export interface RenderableTaxDocument {
  title: TaxDocumentTitle
  documentNumber: string
  documentDate: number
  /** Credit notes only — the invoice this note is issued against. */
  originalInvoiceNumber?: string
  seller: InvoicePartySnapshot
  buyer: InvoicePartySnapshot
  placeOfSupplyStateCode: string
  isInterState: boolean
  lines: InvoiceLine[]
  taxableValuePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  shippingPaise: number
  totalPaise: number
  amountInWords: string
}

const PAGE_MARGIN = 40
const COLUMN_X = { desc: 40, hsn: 210, qty: 260, rate: 300, taxable: 355, gst: 415, total: 490 }
const PAGE_WIDTH = 595.28 // A4 at 72dpi

function addressLines(party: InvoicePartySnapshot): string[] {
  const { address } = party
  const stateLabel = INDIAN_STATE_CODES[address.stateCode as keyof typeof INDIAN_STATE_CODES] ?? address.state
  return [
    address.line1,
    address.line2,
    address.landmark,
    `${address.city}, ${stateLabel} - ${address.pincode}`,
    `Phone: ${address.contactPhone}`,
  ].filter((line): line is string => Boolean(line))
}

/**
 * Renders a GST-compliant tax invoice, bill of supply, or credit note to
 * PDF bytes using pdfkit (no headless-Chrome dependency needed for a
 * text/table-only document, which keeps the function's memory footprint
 * small). Buffers the whole document in memory before resolving — invoices
 * are a few KB, never large enough to need streaming to Storage directly.
 */
export function renderTaxDocumentPdf(doc: RenderableTaxDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN })
    const chunks: Buffer[] = []
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdf.on('end', () => resolve(Buffer.concat(chunks)))
    pdf.on('error', reject)

    // ---- Header ----
    pdf.font('Helvetica-Bold').fontSize(16).text(doc.title, { align: 'center' })
    pdf.moveDown(0.3)
    pdf.font('Helvetica').fontSize(8).fillColor('#4A5560').text(PLATFORM_ROLE_NOTE, { align: 'center' })
    pdf.fillColor('#000000')
    pdf.moveDown(0.8)

    // ---- Seller / buyer panels ----
    const panelTop = pdf.y
    const panelWidth = (PAGE_WIDTH - PAGE_MARGIN * 2 - 20) / 2

    pdf.font('Helvetica-Bold').fontSize(9).text('Sold By', PAGE_MARGIN, panelTop)
    pdf.font('Helvetica').fontSize(9)
    pdf.text(doc.seller.legalName, PAGE_MARGIN, pdf.y, { width: panelWidth })
    for (const line of addressLines(doc.seller)) pdf.text(line, { width: panelWidth })
    if (doc.seller.gstin) pdf.text(`GSTIN: ${doc.seller.gstin}`, { width: panelWidth })
    else pdf.text('Composition scheme dealer — not registered to charge GST', { width: panelWidth })

    const buyerX = PAGE_MARGIN + panelWidth + 20
    pdf.font('Helvetica-Bold').fontSize(9).text('Billed / Shipped To', buyerX, panelTop, { width: panelWidth })
    pdf.font('Helvetica').fontSize(9)
    pdf.text(doc.buyer.legalName, buyerX, pdf.y, { width: panelWidth })
    for (const line of addressLines(doc.buyer)) pdf.text(line, buyerX, pdf.y, { width: panelWidth })
    if (doc.buyer.gstin) pdf.text(`GSTIN: ${doc.buyer.gstin}`, buyerX, pdf.y, { width: panelWidth })

    pdf.moveDown(1)
    const afterPanelsY = Math.max(pdf.y, panelTop + 90)
    pdf.y = afterPanelsY

    // ---- Document meta row ----
    pdf.font('Helvetica-Bold').fontSize(9)
    pdf.text(`${doc.title === 'CREDIT NOTE' ? 'Credit Note' : 'Invoice'} No: `, PAGE_MARGIN, pdf.y, { continued: true })
    pdf.font('Helvetica').text(doc.documentNumber)
    pdf.font('Helvetica-Bold').text('Date: ', PAGE_MARGIN, pdf.y, { continued: true })
    pdf.font('Helvetica').text(formatDateDDMMYYYY(doc.documentDate))
    if (doc.originalInvoiceNumber) {
      pdf.font('Helvetica-Bold').text('Against Invoice: ', PAGE_MARGIN, pdf.y, { continued: true })
      pdf.font('Helvetica').text(doc.originalInvoiceNumber)
    }
    const placeLabel = INDIAN_STATE_CODES[doc.placeOfSupplyStateCode as keyof typeof INDIAN_STATE_CODES] ?? doc.placeOfSupplyStateCode
    pdf.font('Helvetica-Bold').text('Place of Supply: ', PAGE_MARGIN, pdf.y, { continued: true })
    pdf.font('Helvetica').text(`${placeLabel} (${doc.placeOfSupplyStateCode})`)
    pdf.font('Helvetica-Bold').text('Tax Type: ', PAGE_MARGIN, pdf.y, { continued: true })
    pdf.font('Helvetica').text(doc.isInterState ? 'IGST (inter-state)' : 'CGST + SGST (intra-state)')

    pdf.moveDown(0.8)

    // ---- Line items table ----
    const tableTop = pdf.y
    pdf.font('Helvetica-Bold').fontSize(8)
    pdf.text('Description', COLUMN_X.desc, tableTop, { width: COLUMN_X.hsn - COLUMN_X.desc - 4 })
    pdf.text('HSN', COLUMN_X.hsn, tableTop, { width: COLUMN_X.qty - COLUMN_X.hsn - 4 })
    pdf.text('Qty', COLUMN_X.qty, tableTop, { width: COLUMN_X.rate - COLUMN_X.qty - 4, align: 'right' })
    pdf.text('Rate', COLUMN_X.rate, tableTop, { width: COLUMN_X.taxable - COLUMN_X.rate - 4, align: 'right' })
    pdf.text('Taxable', COLUMN_X.taxable, tableTop, { width: COLUMN_X.gst - COLUMN_X.taxable - 4, align: 'right' })
    pdf.text('GST', COLUMN_X.gst, tableTop, { width: COLUMN_X.total - COLUMN_X.gst - 4, align: 'right' })
    pdf.text('Total', COLUMN_X.total, tableTop, { width: PAGE_WIDTH - PAGE_MARGIN - COLUMN_X.total, align: 'right' })
    pdf.moveTo(PAGE_MARGIN, pdf.y + 2).lineTo(PAGE_WIDTH - PAGE_MARGIN, pdf.y + 2).strokeColor('#4A5560').stroke()
    pdf.moveDown(0.5)

    pdf.font('Helvetica').fontSize(8)
    for (const line of doc.lines) {
      const rowTop = pdf.y
      const gstAmountPaise = line.cgstPaise + line.sgstPaise + line.igstPaise
      const gstRateLabel = doc.isInterState ? `IGST ${line.igstRatePercent}%` : `${line.cgstRatePercent + line.sgstRatePercent}%`
      pdf.text(line.description, COLUMN_X.desc, rowTop, { width: COLUMN_X.hsn - COLUMN_X.desc - 4 })
      pdf.text(line.hsnCode, COLUMN_X.hsn, rowTop, { width: COLUMN_X.qty - COLUMN_X.hsn - 4 })
      pdf.text(String(line.qty), COLUMN_X.qty, rowTop, { width: COLUMN_X.rate - COLUMN_X.qty - 4, align: 'right' })
      pdf.text(formatINR(line.unitPricePaise), COLUMN_X.rate, rowTop, { width: COLUMN_X.taxable - COLUMN_X.rate - 4, align: 'right' })
      pdf.text(formatINR(line.taxableValuePaise), COLUMN_X.taxable, rowTop, { width: COLUMN_X.gst - COLUMN_X.taxable - 4, align: 'right' })
      pdf.text(
        gstAmountPaise > 0 ? `${gstRateLabel}\n${formatINR(gstAmountPaise)}` : 'NIL',
        COLUMN_X.gst,
        rowTop,
        { width: COLUMN_X.total - COLUMN_X.gst - 4, align: 'right' },
      )
      pdf.text(formatINR(line.lineTotalPaise), COLUMN_X.total, rowTop, {
        width: PAGE_WIDTH - PAGE_MARGIN - COLUMN_X.total,
        align: 'right',
      })
      pdf.moveDown(0.6)
    }

    pdf.moveTo(PAGE_MARGIN, pdf.y).lineTo(PAGE_WIDTH - PAGE_MARGIN, pdf.y).strokeColor('#4A5560').stroke()
    pdf.moveDown(0.5)

    // ---- Totals ----
    const totalsX = COLUMN_X.taxable
    const totalsWidth = PAGE_WIDTH - PAGE_MARGIN - totalsX
    function totalRow(label: string, valuePaise: number, bold = false) {
      pdf.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
      pdf.text(label, totalsX, pdf.y, { continued: true, width: totalsWidth })
      pdf.text(formatINR(valuePaise), { align: 'right' })
    }
    totalRow('Taxable Value', doc.taxableValuePaise)
    if (doc.cgstPaise > 0) totalRow('CGST', doc.cgstPaise)
    if (doc.sgstPaise > 0) totalRow('SGST', doc.sgstPaise)
    if (doc.igstPaise > 0) totalRow('IGST', doc.igstPaise)
    if (doc.shippingPaise > 0) totalRow('Shipping', doc.shippingPaise)
    totalRow('Total', doc.totalPaise, true)

    pdf.moveDown(0.8)
    pdf.font('Helvetica-Bold').fontSize(9).text('Amount in Words: ', PAGE_MARGIN, pdf.y, { continued: true })
    pdf.font('Helvetica').text(doc.amountInWords)

    pdf.moveDown(1.2)
    pdf.font('Helvetica-Bold').fontSize(9).text('Declaration')
    pdf.font('Helvetica').fontSize(8).text(
      'We declare that this document shows the actual price of the goods described and that all particulars are true and correct. ' +
        'Tax, where applicable, has been charged in accordance with the provisions of the CGST/SGST/IGST Act, 2017.',
    )

    pdf.moveDown(1.5)
    pdf.font('Helvetica').fontSize(8).fillColor('#4A5560').text('This is a system-generated document and does not require a signature.')

    pdf.end()
  })
}
