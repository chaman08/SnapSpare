import { randomUUID } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { describe, expect, it } from 'vitest'
import { commitSequence, formatDocumentNumber, readNextSequence, resolveSellerInvoiceCode, type DocumentKind } from '../invoiceNumbering.js'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'

initializeApp({ projectId: 'demo-snapspare' })
const db = getFirestore()

/**
 * invoiceNumbering.ts's own doc comment claims "two subOrders shipping for
 * the same seller in the same millisecond can never be handed the same
 * number" — this is that claim under an actual concurrency test, the same
 * way stockConcurrency.emulator.test.ts proves the stock-decrement
 * transaction never oversells. Run with `pnpm test:emulator`.
 */

async function allocateSequence(kind: DocumentKind, sellerId: string, financialYear: string): Promise<number> {
  return db.runTransaction(async (tx) => {
    const pending = await readNextSequence(tx, db, kind, sellerId, financialYear)
    commitSequence(tx, pending, sellerId, financialYear, Date.now())
    return pending.sequence
  })
}

function freshSellerId(): string {
  return `seller-${randomUUID()}`
}

describe('invoice/credit-note sequence allocation concurrency', () => {
  it('never hands two concurrent callers the same invoice sequence number for the same seller + financial year', async () => {
    const sellerId = freshSellerId()
    const financialYear = 'FY25-26'
    const CONCURRENT_CALLERS = 8

    const sequences = await Promise.all(
      Array.from({ length: CONCURRENT_CALLERS }, () => allocateSequence('invoice', sellerId, financialYear)),
    )

    // Every sequence number handed out must be unique...
    expect(new Set(sequences).size).toBe(CONCURRENT_CALLERS)
    // ...and contiguous from 1, i.e. no number was skipped and none was reused.
    expect([...sequences].sort((a, b) => a - b)).toEqual(Array.from({ length: CONCURRENT_CALLERS }, (_, i) => i + 1))

    const counterSnapshot = await db.collection('invoiceCounters').doc(`${sellerId}_${financialYear}`).get()
    expect(counterSnapshot.data()?.lastNumber).toBe(CONCURRENT_CALLERS)
  })

  it('keeps invoice and credit-note sequences independent even for the same seller + financial year', async () => {
    const sellerId = freshSellerId()
    const financialYear = 'FY25-26'

    const [invoiceSeq1, creditNoteSeq1, invoiceSeq2, creditNoteSeq2] = await Promise.all([
      allocateSequence('invoice', sellerId, financialYear),
      allocateSequence('creditNote', sellerId, financialYear),
      allocateSequence('invoice', sellerId, financialYear),
      allocateSequence('creditNote', sellerId, financialYear),
    ])

    // Each kind has its own 1..2 run, unaffected by the other kind's calls landing concurrently.
    expect([invoiceSeq1, invoiceSeq2].sort((a, b) => a - b)).toEqual([1, 2])
    expect([creditNoteSeq1, creditNoteSeq2].sort((a, b) => a - b)).toEqual([1, 2])

    const invoiceCounter = await db.collection('invoiceCounters').doc(`${sellerId}_${financialYear}`).get()
    const creditNoteCounter = await db.collection('creditNoteCounters').doc(`${sellerId}_${financialYear}`).get()
    expect(invoiceCounter.data()?.lastNumber).toBe(2)
    expect(creditNoteCounter.data()?.lastNumber).toBe(2)
  })

  it('keeps sequences independent across different sellers racing at the same instant', async () => {
    const sellerA = freshSellerId()
    const sellerB = freshSellerId()
    const financialYear = 'FY25-26'
    const CALLS_PER_SELLER = 5

    const results = await Promise.all([
      ...Array.from({ length: CALLS_PER_SELLER }, () => allocateSequence('invoice', sellerA, financialYear)),
      ...Array.from({ length: CALLS_PER_SELLER }, () => allocateSequence('invoice', sellerB, financialYear)),
    ])

    const sellerASequences = results.slice(0, CALLS_PER_SELLER).sort((a, b) => a - b)
    const sellerBSequences = results.slice(CALLS_PER_SELLER).sort((a, b) => a - b)
    expect(sellerASequences).toEqual([1, 2, 3, 4, 5])
    expect(sellerBSequences).toEqual([1, 2, 3, 4, 5])
  })

  it('keeps sequences independent across financial years for the same seller', async () => {
    const sellerId = freshSellerId()

    const [fy25a, fy25b, fy26a] = await Promise.all([
      allocateSequence('invoice', sellerId, 'FY24-25'),
      allocateSequence('invoice', sellerId, 'FY24-25'),
      allocateSequence('invoice', sellerId, 'FY25-26'),
    ])

    expect([fy25a, fy25b].sort((a, b) => a - b)).toEqual([1, 2])
    expect(fy26a).toBe(1) // a new financial year starts its own sequence at 1, unaffected by the prior year's count
  })

  it('resumes from the persisted lastNumber rather than restarting, for a counter that already has history', async () => {
    const sellerId = freshSellerId()
    const financialYear = 'FY25-26'
    await db.collection('invoiceCounters').doc(`${sellerId}_${financialYear}`).set({
      sellerId,
      financialYear,
      lastNumber: 41,
      updatedAt: Date.now(),
    })

    const next = await allocateSequence('invoice', sellerId, financialYear)
    expect(next).toBe(42)
  })
})

describe('formatDocumentNumber / resolveSellerInvoiceCode (pure formatting, exercised here alongside the concurrency suite)', () => {
  it('formats an invoice number as SELLERCODE/FY/000123', () => {
    expect(formatDocumentNumber('invoice', 'ACME12', 'FY25-26', 123)).toBe('ACME12/FY25-26/000123')
  })

  it('formats a credit-note number with the CN- prefix on the year segment', () => {
    expect(formatDocumentNumber('creditNote', 'ACME12', 'FY25-26', 45)).toBe('ACME12/CN-FY25-26/000045')
  })

  it('pads the sequence to 6 digits', () => {
    expect(formatDocumentNumber('invoice', 'ACME12', 'FY25-26', 1)).toBe('ACME12/FY25-26/000001')
  })

  it('sanitises a seller code with punctuation/lowercase into uppercase alphanumeric', () => {
    expect(resolveSellerInvoiceCode({ id: 'seller-1', sellerCode: 'acme-parts.co' })).toBe('ACMEPARTSCO')
  })

  it('falls back to the seller id, sanitised, when sellerCode is absent', () => {
    expect(resolveSellerInvoiceCode({ id: 'abc-123' })).toBe('ABC123')
  })
})
