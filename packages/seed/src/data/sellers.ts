import { computeGstinCheckDigit } from '@snapspare/shared'

export interface SellerBlueprint {
  id: string
  ownerUserId: string
  ownerPhone: string
  ownerName: string
  businessName: string
  legalName: string
  stateCode: string
  stateName: string
  city: string
  pincode: string
  pan: string
  businessType: 'individual' | 'proprietorship' | 'partnership' | 'pvt_ltd' | 'llp' | 'other'
  categorySlugs: string[]
  bankAccount: { accountHolderName: string; accountNumber: string; ifsc: string; bankName: string }
}

/** Builds a real-format, checksum-valid GSTIN for the given state code + PAN (entity code fixed at '1'). */
export function buildGstin(stateCode: string, pan: string): string {
  const first14 = `${stateCode}${pan}1Z`
  const checkDigit = computeGstinCheckDigit(first14)
  return `${first14}${checkDigit}`
}

// PAN's 4th letter conventionally encodes holder type: C=Company, P=Individual,
// F=Firm/LLP. Digits/letters below are fabricated but format-valid.
export const SELLER_BLUEPRINTS: SellerBlueprint[] = [
  {
    id: 'seller-maharashtra-autozone',
    ownerUserId: 'seller-owner-mh',
    ownerPhone: '9820011001',
    ownerName: 'Rohan Deshmukh',
    businessName: 'AutoZone Traders',
    legalName: 'AutoZone Traders Pvt Ltd',
    stateCode: '27',
    stateName: 'Maharashtra',
    city: 'Mumbai',
    pincode: '400001',
    pan: 'AAZCA1234C',
    businessType: 'pvt_ltd',
    categorySlugs: ['engine', 'brake', 'filters'],
    bankAccount: {
      accountHolderName: 'AutoZone Traders Pvt Ltd',
      accountNumber: '000405001234',
      ifsc: 'HDFC0000123',
      bankName: 'HDFC Bank',
    },
  },
  {
    id: 'seller-delhi-capitalauto',
    ownerUserId: 'seller-owner-dl',
    ownerPhone: '9871122002',
    ownerName: 'Vikram Chadha',
    businessName: 'Capital Auto Spares',
    legalName: 'Capital Auto Spares',
    stateCode: '07',
    stateName: 'Delhi',
    city: 'New Delhi',
    pincode: '110001',
    pan: 'AAPCA5678D',
    businessType: 'proprietorship',
    categorySlugs: ['electrical', 'lighting', 'battery'],
    bankAccount: {
      accountHolderName: 'Vikram Chadha',
      accountNumber: '011002003456',
      ifsc: 'ICIC0001122',
      bankName: 'ICICI Bank',
    },
  },
  {
    id: 'seller-tamilnadu-chennaimotor',
    ownerUserId: 'seller-owner-tn',
    ownerPhone: '9840033003',
    ownerName: 'Karthik Subramaniam',
    businessName: 'Chennai Motor Parts',
    legalName: 'Chennai Motor Parts LLP',
    stateCode: '33',
    stateName: 'Tamil Nadu',
    city: 'Chennai',
    pincode: '600001',
    pan: 'AAFCM4321F',
    businessType: 'llp',
    categorySlugs: ['clutch-and-transmission', 'cooling', 'bearings'],
    bankAccount: {
      accountHolderName: 'Chennai Motor Parts LLP',
      accountNumber: '022003004567',
      ifsc: 'SBIN0005678',
      bankName: 'State Bank of India',
    },
  },
  {
    id: 'seller-gujarat-gujautohub',
    ownerUserId: 'seller-owner-gj',
    ownerPhone: '9909944004',
    ownerName: 'Kiran Patel',
    businessName: 'Gujarat Auto Hub',
    legalName: 'Gujarat Auto Hub Pvt Ltd',
    stateCode: '24',
    stateName: 'Gujarat',
    city: 'Ahmedabad',
    pincode: '380001',
    pan: 'AAZCG8765G',
    businessType: 'pvt_ltd',
    categorySlugs: ['suspension-and-steering', 'exhaust', 'consumables'],
    bankAccount: {
      accountHolderName: 'Gujarat Auto Hub Pvt Ltd',
      accountNumber: '033004005678',
      ifsc: 'AXIS0002233',
      bankName: 'Axis Bank',
    },
  },
  {
    id: 'seller-up-upsparesbazaar',
    ownerUserId: 'seller-owner-up',
    ownerPhone: '9450055005',
    ownerName: 'Anand Srivastava',
    businessName: 'UP Spares Bazaar',
    legalName: 'UP Spares Bazaar',
    stateCode: '09',
    stateName: 'Uttar Pradesh',
    city: 'Lucknow',
    pincode: '226001',
    pan: 'AAPCU2345H',
    businessType: 'proprietorship',
    categorySlugs: ['tyres-and-wheels', 'cables', 'tools'],
    bankAccount: {
      accountHolderName: 'Anand Srivastava',
      accountNumber: '044005006789',
      ifsc: 'PUNB0334400',
      bankName: 'Punjab National Bank',
    },
  },
  {
    id: 'seller-karnataka-bengaluruauto',
    ownerUserId: 'seller-owner-ka',
    ownerPhone: '9880066006',
    ownerName: 'Suresh Gowda',
    businessName: 'Bengaluru Auto Traders',
    legalName: 'Bengaluru Auto Traders',
    stateCode: '29',
    stateName: 'Karnataka',
    city: 'Bengaluru',
    pincode: '560001',
    pan: 'AAFCB6789J',
    businessType: 'partnership',
    categorySlugs: ['body-and-panels', 'accessories', 'lubricants-and-fluids'],
    bankAccount: {
      accountHolderName: 'Bengaluru Auto Traders',
      accountNumber: '055006007890',
      ifsc: 'KARB0000099',
      bankName: 'Karnataka Bank',
    },
  },
  {
    id: 'seller-westbengal-kolkataauto',
    ownerUserId: 'seller-owner-wb',
    ownerPhone: '9831077007',
    ownerName: 'Debashish Roy',
    businessName: 'Kolkata Auto Distributors',
    legalName: 'Kolkata Auto Distributors Pvt Ltd',
    stateCode: '19',
    stateName: 'West Bengal',
    city: 'Kolkata',
    pincode: '700001',
    pan: 'AAZCK3456K',
    businessType: 'pvt_ltd',
    categorySlugs: ['engine', 'electrical', 'battery'],
    bankAccount: {
      accountHolderName: 'Kolkata Auto Distributors Pvt Ltd',
      accountNumber: '066007008901',
      ifsc: 'UBIN0554400',
      bankName: 'Union Bank of India',
    },
  },
  {
    id: 'seller-chhattisgarh-cgmotorspares',
    ownerUserId: 'seller-owner-cg',
    ownerPhone: '9827088008',
    ownerName: 'Ramesh Sahu',
    businessName: 'Chhattisgarh Motor Spares',
    legalName: 'Chhattisgarh Motor Spares',
    stateCode: '22',
    stateName: 'Chhattisgarh',
    city: 'Raipur',
    pincode: '492001',
    pan: 'AAPCS7890L',
    businessType: 'proprietorship',
    categorySlugs: ['brake', 'suspension-and-steering', 'filters'],
    bankAccount: {
      accountHolderName: 'Ramesh Sahu',
      accountNumber: '077008009012',
      ifsc: 'IDIB0004400',
      bankName: 'Indian Bank',
    },
  },
]
