import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { ledgerEntryIdSchema, ledgerIdSchema, sellerIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const ledgerOwnerTypeSchema = z.enum(['seller', 'platform'])
export type LedgerOwnerType = z.infer<typeof ledgerOwnerTypeSchema>

/** One ledger per owner (currently: one per seller). Running balance is a signed amount — it can go negative if refunds/adjustments exceed what's owed. */
export const ledgerSchema = z.object({
  id: ledgerIdSchema,
  ownerType: ledgerOwnerTypeSchema,
  ownerId: sellerIdSchema,
  currentBalancePaise: z.number().int(),
  lastEntryAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Ledger = z.infer<typeof ledgerSchema>

export const ledgerConverter = makeFirestoreConverter(ledgerSchema)

export const ledgerEntryTypeSchema = z.enum([
  'order_credit',
  'commission_debit',
  'refund_debit',
  'payout_debit',
  'adjustment',
  /** Section 52 TCS withheld against this seller's net taxable supplies — posted by functions/src/tax at invoice time (`direction: 'debit'`) and reversed proportionally on a return's credit note (`direction: 'credit'`, same type). Config-driven rate; see config/tax and pricing/tax.ts's computeTcs. */
  'tcs_debit',
  /** Section 194-O TDS withheld on gross sales to this (resident) seller — same debit-at-invoice/credit-at-return-reversal treatment as tcs_debit. Config-driven rate/threshold; see config/tax and pricing/tax.ts's computeTds. */
  'tds_debit',
  /** Shipping cost the platform fronted booking the shipment via the shipping provider on the seller's behalf, recovered here — posted alongside order_credit/commission_debit at delivery, see functions/src/payments/applyCommissionOnDelivered.ts. */
  'shipping_charge',
  /** SLA-breach or other configured penalty debit — currently only posted by autoCancelUnacceptedSubOrders.ts when config/commission.slaBreachPenaltyPaise is set. */
  'penalty',
  /** Posted only by functions/src/disputes/resolveDispute.ts when an admin forces a `refund_buyer`/`partial_refund` outcome — distinct from the buyer-initiated `refund_debit` so seller-facing reports can separate ordinary returns from admin-forced dispute payouts. */
  'dispute_refund_debit',
])
export type LedgerEntryType = z.infer<typeof ledgerEntryTypeSchema>

export const ledgerEntryReferenceTypeSchema = z.enum([
  'order',
  'subOrder',
  'payout',
  'return',
  'invoice',
  'creditNote',
  'dispute',
])
export type LedgerEntryReferenceType = z.infer<typeof ledgerEntryReferenceTypeSchema>

export const ledgerEntrySchema = z.object({
  id: ledgerEntryIdSchema,
  ledgerId: ledgerIdSchema,
  type: ledgerEntryTypeSchema,
  direction: z.enum(['credit', 'debit']),
  amountPaise: z.number().int().nonnegative(),
  balanceAfterPaise: z.number().int(),
  referenceType: ledgerEntryReferenceTypeSchema.optional(),
  referenceId: z.string().optional(),
  description: z.string().optional(),
  createdAt: epochMsSchema,
})
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>

export const ledgerEntryConverter = makeFirestoreConverter(ledgerEntrySchema)
