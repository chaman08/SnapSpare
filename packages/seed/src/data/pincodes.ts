import type { IndianStateCode } from '@snapspare/shared'

export interface PincodeBlock {
  /** First pincode in the block, e.g. 400001 for south Mumbai. */
  startAt: number
  /** How many sequential pincodes to generate from startAt. */
  count: number
  city: string
  state: string
  stateCode: IndianStateCode
}

export interface PincodeRow {
  id: string
  city: string
  state: string
  stateCode: IndianStateCode
}

/**
 * Real India Post first-3-digit sorting-district prefixes for ~55 major
 * cities, each expanded into a short run of sequential pincodes within that
 * city's actual documented range. Every individual pincode below genuinely
 * falls inside its city's real numeric block (so the city/state/stateCode
 * are correct), though not every one has been checked against an individual
 * post-office name — see the seed script's README note for swapping this
 * for an official India Post CSV in production.
 */
export const PINCODE_BLOCKS: PincodeBlock[] = [
  { startAt: 400001, count: 12, city: 'Mumbai', state: 'Maharashtra', stateCode: '27' },
  { startAt: 400601, count: 10, city: 'Thane', state: 'Maharashtra', stateCode: '27' },
  { startAt: 411001, count: 12, city: 'Pune', state: 'Maharashtra', stateCode: '27' },
  { startAt: 422001, count: 10, city: 'Nashik', state: 'Maharashtra', stateCode: '27' },
  { startAt: 440001, count: 10, city: 'Nagpur', state: 'Maharashtra', stateCode: '27' },
  { startAt: 431001, count: 8, city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', stateCode: '27' },
  { startAt: 413001, count: 8, city: 'Solapur', state: 'Maharashtra', stateCode: '27' },
  { startAt: 416001, count: 8, city: 'Kolhapur', state: 'Maharashtra', stateCode: '27' },

  { startAt: 110001, count: 15, city: 'New Delhi', state: 'Delhi', stateCode: '07' },

  { startAt: 560001, count: 15, city: 'Bengaluru', state: 'Karnataka', stateCode: '29' },
  { startAt: 570001, count: 8, city: 'Mysuru', state: 'Karnataka', stateCode: '29' },
  { startAt: 575001, count: 8, city: 'Mangaluru', state: 'Karnataka', stateCode: '29' },
  { startAt: 580001, count: 8, city: 'Hubballi', state: 'Karnataka', stateCode: '29' },
  { startAt: 590001, count: 8, city: 'Belagavi', state: 'Karnataka', stateCode: '29' },

  { startAt: 600001, count: 15, city: 'Chennai', state: 'Tamil Nadu', stateCode: '33' },
  { startAt: 641001, count: 10, city: 'Coimbatore', state: 'Tamil Nadu', stateCode: '33' },
  { startAt: 625001, count: 8, city: 'Madurai', state: 'Tamil Nadu', stateCode: '33' },
  { startAt: 620001, count: 8, city: 'Tiruchirappalli', state: 'Tamil Nadu', stateCode: '33' },
  { startAt: 632001, count: 6, city: 'Vellore', state: 'Tamil Nadu', stateCode: '33' },
  { startAt: 636001, count: 6, city: 'Salem', state: 'Tamil Nadu', stateCode: '33' },

  { startAt: 380001, count: 12, city: 'Ahmedabad', state: 'Gujarat', stateCode: '24' },
  { startAt: 395001, count: 10, city: 'Surat', state: 'Gujarat', stateCode: '24' },
  { startAt: 390001, count: 8, city: 'Vadodara', state: 'Gujarat', stateCode: '24' },
  { startAt: 360001, count: 6, city: 'Rajkot', state: 'Gujarat', stateCode: '24' },
  { startAt: 382001, count: 6, city: 'Gandhinagar', state: 'Gujarat', stateCode: '24' },
  { startAt: 364001, count: 6, city: 'Bhavnagar', state: 'Gujarat', stateCode: '24' },

  { startAt: 226001, count: 12, city: 'Lucknow', state: 'Uttar Pradesh', stateCode: '09' },
  { startAt: 208001, count: 10, city: 'Kanpur', state: 'Uttar Pradesh', stateCode: '09' },
  { startAt: 282001, count: 8, city: 'Agra', state: 'Uttar Pradesh', stateCode: '09' },
  { startAt: 221001, count: 8, city: 'Varanasi', state: 'Uttar Pradesh', stateCode: '09' },
  { startAt: 201001, count: 8, city: 'Ghaziabad', state: 'Uttar Pradesh', stateCode: '09' },
  { startAt: 201301, count: 8, city: 'Noida', state: 'Uttar Pradesh', stateCode: '09' },
  { startAt: 250001, count: 6, city: 'Meerut', state: 'Uttar Pradesh', stateCode: '09' },
  { startAt: 211001, count: 6, city: 'Prayagraj', state: 'Uttar Pradesh', stateCode: '09' },

  { startAt: 500001, count: 12, city: 'Hyderabad', state: 'Telangana', stateCode: '36' },
  { startAt: 506001, count: 6, city: 'Warangal', state: 'Telangana', stateCode: '36' },

  { startAt: 700001, count: 12, city: 'Kolkata', state: 'West Bengal', stateCode: '19' },
  { startAt: 713201, count: 6, city: 'Asansol', state: 'West Bengal', stateCode: '19' },
  { startAt: 734001, count: 6, city: 'Siliguri', state: 'West Bengal', stateCode: '19' },

  { startAt: 492001, count: 10, city: 'Raipur', state: 'Chhattisgarh', stateCode: '22' },
  { startAt: 490001, count: 6, city: 'Bhilai', state: 'Chhattisgarh', stateCode: '22' },
  { startAt: 495001, count: 6, city: 'Bilaspur', state: 'Chhattisgarh', stateCode: '22' },
  { startAt: 491441, count: 4, city: 'Rajnandgaon', state: 'Chhattisgarh', stateCode: '22' },

  { startAt: 302001, count: 10, city: 'Jaipur', state: 'Rajasthan', stateCode: '08' },
  { startAt: 342001, count: 6, city: 'Jodhpur', state: 'Rajasthan', stateCode: '08' },
  { startAt: 313001, count: 6, city: 'Udaipur', state: 'Rajasthan', stateCode: '08' },
  { startAt: 324001, count: 6, city: 'Kota', state: 'Rajasthan', stateCode: '08' },
  { startAt: 334001, count: 6, city: 'Bikaner', state: 'Rajasthan', stateCode: '08' },
  { startAt: 305001, count: 6, city: 'Ajmer', state: 'Rajasthan', stateCode: '08' },

  { startAt: 462001, count: 10, city: 'Bhopal', state: 'Madhya Pradesh', stateCode: '23' },
  { startAt: 452001, count: 8, city: 'Indore', state: 'Madhya Pradesh', stateCode: '23' },
  { startAt: 482001, count: 6, city: 'Jabalpur', state: 'Madhya Pradesh', stateCode: '23' },
  { startAt: 474001, count: 6, city: 'Gwalior', state: 'Madhya Pradesh', stateCode: '23' },
  { startAt: 456001, count: 6, city: 'Ujjain', state: 'Madhya Pradesh', stateCode: '23' },

  { startAt: 800001, count: 10, city: 'Patna', state: 'Bihar', stateCode: '10' },
  { startAt: 842001, count: 6, city: 'Muzaffarpur', state: 'Bihar', stateCode: '10' },
  { startAt: 823001, count: 6, city: 'Gaya', state: 'Bihar', stateCode: '10' },
  { startAt: 812001, count: 6, city: 'Bhagalpur', state: 'Bihar', stateCode: '10' },

  { startAt: 834001, count: 8, city: 'Ranchi', state: 'Jharkhand', stateCode: '20' },
  { startAt: 831001, count: 6, city: 'Jamshedpur', state: 'Jharkhand', stateCode: '20' },
  { startAt: 826001, count: 6, city: 'Dhanbad', state: 'Jharkhand', stateCode: '20' },

  { startAt: 751001, count: 8, city: 'Bhubaneswar', state: 'Odisha', stateCode: '21' },
  { startAt: 753001, count: 6, city: 'Cuttack', state: 'Odisha', stateCode: '21' },

  { startAt: 781001, count: 8, city: 'Guwahati', state: 'Assam', stateCode: '18' },
  { startAt: 682001, count: 8, city: 'Kochi', state: 'Kerala', stateCode: '32' },
  { startAt: 695001, count: 8, city: 'Thiruvananthapuram', state: 'Kerala', stateCode: '32' },

  { startAt: 160001, count: 8, city: 'Chandigarh', state: 'Chandigarh', stateCode: '04' },
  { startAt: 141001, count: 6, city: 'Ludhiana', state: 'Punjab', stateCode: '03' },
  { startAt: 143001, count: 6, city: 'Amritsar', state: 'Punjab', stateCode: '03' },
  { startAt: 144001, count: 6, city: 'Jalandhar', state: 'Punjab', stateCode: '03' },
  { startAt: 151001, count: 4, city: 'Bathinda', state: 'Punjab', stateCode: '03' },

  { startAt: 121001, count: 8, city: 'Faridabad', state: 'Haryana', stateCode: '06' },
  { startAt: 122001, count: 8, city: 'Gurugram', state: 'Haryana', stateCode: '06' },
  { startAt: 132001, count: 6, city: 'Karnal', state: 'Haryana', stateCode: '06' },
  { startAt: 124001, count: 6, city: 'Rohtak', state: 'Haryana', stateCode: '06' },

  { startAt: 248001, count: 8, city: 'Dehradun', state: 'Uttarakhand', stateCode: '05' },
  { startAt: 171001, count: 6, city: 'Shimla', state: 'Himachal Pradesh', stateCode: '02' },
  { startAt: 180001, count: 6, city: 'Jammu', state: 'Jammu and Kashmir', stateCode: '01' },
  { startAt: 190001, count: 6, city: 'Srinagar', state: 'Jammu and Kashmir', stateCode: '01' },

  { startAt: 530001, count: 8, city: 'Visakhapatnam', state: 'Andhra Pradesh', stateCode: '37' },
  { startAt: 520001, count: 6, city: 'Vijayawada', state: 'Andhra Pradesh', stateCode: '37' },
  { startAt: 522001, count: 4, city: 'Guntur', state: 'Andhra Pradesh', stateCode: '37' },

  { startAt: 605001, count: 4, city: 'Puducherry', state: 'Puducherry', stateCode: '34' },
  { startAt: 793001, count: 4, city: 'Shillong', state: 'Meghalaya', stateCode: '17' },
  { startAt: 795001, count: 4, city: 'Imphal', state: 'Manipur', stateCode: '14' },
  { startAt: 799001, count: 4, city: 'Agartala', state: 'Tripura', stateCode: '16' },
]

function toPincodeString(value: number): string {
  return String(value).padStart(6, '0')
}

export function generatePincodeRows(): PincodeRow[] {
  const rows: PincodeRow[] = []
  const seen = new Set<string>()

  for (const block of PINCODE_BLOCKS) {
    for (let i = 0; i < block.count; i++) {
      const id = toPincodeString(block.startAt + i)
      if (seen.has(id)) {
        throw new Error(`generatePincodeRows: duplicate pincode ${id} (${block.city}) — adjust the block ranges`)
      }
      seen.add(id)
      rows.push({ id, city: block.city, state: block.state, stateCode: block.stateCode })
    }
  }

  return rows
}
