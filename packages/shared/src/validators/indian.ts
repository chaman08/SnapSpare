import { z } from 'zod'

const GSTIN_CODEPOINTS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

/**
 * GSTIN's 15th character is a mod-36 check digit over the first 14 characters
 * (same algorithm used by GSTN and every third-party GSTIN validator).
 */
export function computeGstinCheckDigit(first14: string): string {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const codePoint = GSTIN_CODEPOINTS.indexOf(first14[i] as string)
    const factor = i % 2 === 0 ? 1 : 2
    const product = codePoint * factor
    sum += Math.floor(product / 36) + (product % 36)
  }
  const checkCodePoint = (36 - (sum % 36)) % 36
  return GSTIN_CODEPOINTS[checkCodePoint] as string
}

// Note: none of these are zod-`.brand()`-ed — see the comment in ids.ts for why
// (tsup's .d.ts bundler silently drops the brand across the package boundary).
export const gstinSchema = z
  .string()
  .toUpperCase()
  .regex(GSTIN_FORMAT, 'Invalid GSTIN format')
  .refine((gstin) => computeGstinCheckDigit(gstin.slice(0, 14)) === gstin[14], {
    message: 'Invalid GSTIN checksum',
  })
export type Gstin = z.infer<typeof gstinSchema>

/** PAN has no public checksum algorithm — format only. 4th letter encodes holder type. */
export const panSchema = z
  .string()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format')
export type Pan = z.infer<typeof panSchema>

/** Indian PIN codes never start with 0. */
export const pincodeSchema = z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid 6-digit pincode')
export type Pincode = z.infer<typeof pincodeSchema>

/** 10-digit Indian mobile number, no country code, must start 6-9. */
export const mobileSchema = z.string().regex(/^[6-9][0-9]{9}$/, 'Invalid 10-digit mobile number')
export type Mobile = z.infer<typeof mobileSchema>

/** IFSC: 4 bank-code letters + reserved '0' + 6-char branch code. */
export const ifscSchema = z
  .string()
  .toUpperCase()
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code')
export type Ifsc = z.infer<typeof ifscSchema>

/** HSN codes used on Indian GST invoices are 4, 6, or 8 digits. */
export const hsnSchema = z.string().regex(/^([0-9]{4}|[0-9]{6}|[0-9]{8})$/, 'HSN code must be 4, 6, or 8 digits')
export type Hsn = z.infer<typeof hsnSchema>

// Standard: 2 state letters + 1-2 RTO digits + 0-3 series letters + 4-digit number
// (e.g. MH12AB1234). BH-series (Bharat series, 2021+): 2-digit year + "BH" +
// 4-digit number + 1-2 letters (e.g. 22BH1234AB).
const VEHICLE_REG_STANDARD = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/
const VEHICLE_REG_BH_SERIES = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/

/** Indian vehicle registration number, normalised (uppercased, spaces/hyphens stripped) before validation. */
export const vehicleRegistrationSchema = z
  .string()
  .transform((value) => value.toUpperCase().replace(/[\s-]/g, ''))
  .refine(
    (value) => VEHICLE_REG_STANDARD.test(value) || VEHICLE_REG_BH_SERIES.test(value),
    'Enter a valid vehicle registration number (e.g. MH12AB1234)',
  )
export type VehicleRegistration = z.infer<typeof vehicleRegistrationSchema>
