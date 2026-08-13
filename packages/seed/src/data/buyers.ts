import type { BuyerType } from '@snapspare/shared'
import { buildGstin } from './sellers.js'

export interface BuyerBlueprint {
  id: string
  phone: string
  displayName: string
  buyerType: BuyerType
  gstin?: string
  /** When set, a creditAccounts/{id} doc is created for this buyer at this credit limit. */
  creditLimitPaise?: number
}

export const BUYER_BLUEPRINTS: BuyerBlueprint[] = [
  {
    id: 'buyer-retail-priya',
    phone: '9876500001',
    displayName: 'Priya Nair',
    buyerType: 'retail',
  },
  {
    id: 'buyer-mechanic-imran',
    phone: '9876500002',
    displayName: 'Imran Sheikh',
    buyerType: 'mechanic',
  },
  {
    id: 'buyer-garage-shreeganesh',
    phone: '9876500003',
    displayName: 'Shree Ganesh Auto Works',
    buyerType: 'garage',
    // "one with GSTIN"
    gstin: buildGstin('29', 'AAPCG4567M'),
  },
  {
    id: 'buyer-fleet-swiftlogistics',
    phone: '9876500004',
    displayName: 'Swift Logistics Fleet',
    buyerType: 'fleet',
    // "one with credit enabled"
    creditLimitPaise: 50_000_00, // ₹50,000 credit line
  },
  {
    id: 'buyer-reseller-partsbazaar',
    phone: '9876500005',
    displayName: 'Parts Bazaar Reselling Co.',
    buyerType: 'reseller',
  },
  {
    id: 'buyer-retail-arjun',
    phone: '9876500006',
    displayName: 'Arjun Mehta',
    buyerType: 'retail',
  },
]
