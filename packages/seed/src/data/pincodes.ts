import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { IndianStateCode } from '@snapspare/shared'

export interface PincodeRow {
  id: string
  city: string
  state: string
  stateCode: IndianStateCode
}

const DATA_PATH = fileURLToPath(new URL('./pincodes.json', import.meta.url))

/**
 * Real India Post pincode -> city/state master data (~19,300 rows, one per
 * active 6-digit PIN as of this dataset's snapshot), derived from the
 * official All India Pincode Directory (data.gov.in) and deduped to one
 * district/state per pincode (a PIN can cover several post offices; the
 * first one encountered per PIN wins). Regenerate by re-running the same
 * dedupe/normalize pass against a fresh directory export if it goes stale.
 */
export function generatePincodeRows(): PincodeRow[] {
  return JSON.parse(readFileSync(DATA_PATH, 'utf-8')) as PincodeRow[]
}
