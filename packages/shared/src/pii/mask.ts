/**
 * Display/log-safe masking for financial and tax identifiers (design brief
 * Phase 23: "mask bank and GSTIN in all list views and logs"). These are for
 * places the full value isn't the point — an admin scanning a seller list,
 * or a structured log line — never for a generated legal document (a GST
 * invoice, a GSTR report, an e-way bill) or the payout provider's own API
 * call, all of which legally require the real, unmasked value and must keep
 * reading it straight off the source document.
 */

const MASK_CHAR = '•'

/** Masks all but the last `keepLast` characters, preserving length so a masked value still visually reads as "a value of this length" rather than a generic redaction. */
function maskKeepingTail(value: string, keepLast: number): string {
  if (value.length <= keepLast) return MASK_CHAR.repeat(value.length)
  return MASK_CHAR.repeat(value.length - keepLast) + value.slice(-keepLast)
}

/** Bank account number: only the last 4 digits are shown, e.g. `••••••1234`. */
export function maskBankAccountNumber(accountNumber: string): string {
  return maskKeepingTail(accountNumber, 4)
}

/** IFSC (bank code + branch): bank code (first 4 letters) stays visible for at-a-glance identification, the branch-identifying remainder is masked, e.g. `HDFC••••56`. */
export function maskIfsc(ifsc: string): string {
  if (ifsc.length <= 6) return maskKeepingTail(ifsc, 2)
  const bankCode = ifsc.slice(0, 4)
  const tail = ifsc.slice(-2)
  return `${bankCode}${MASK_CHAR.repeat(Math.max(0, ifsc.length - 6))}${tail}`
}

/** GSTIN (15 chars: 2-digit state code + 10-char PAN + entity/checksum): state code and last 4 chars stay visible, e.g. `27•••••••1F1Z5`. */
export function maskGstin(gstin: string): string {
  if (gstin.length <= 6) return maskKeepingTail(gstin, 2)
  const stateCode = gstin.slice(0, 2)
  const tail = gstin.slice(-4)
  return `${stateCode}${MASK_CHAR.repeat(Math.max(0, gstin.length - 6))}${tail}`
}

/** PAN (10 chars): first 4 and last 1 stay visible, matching the partial-PAN convention used on Indian financial statements, e.g. `ABCD••••••Z`. */
export function maskPan(pan: string): string {
  if (pan.length <= 5) return maskKeepingTail(pan, 1)
  const head = pan.slice(0, 4)
  const tail = pan.slice(-1)
  return `${head}${MASK_CHAR.repeat(Math.max(0, pan.length - 5))}${tail}`
}
