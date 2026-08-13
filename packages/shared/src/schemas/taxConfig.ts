import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { paiseSchema } from '../types/money'
import { epochMsSchema } from './common'

/**
 * Firestore-backed mirror of pricing/tax.ts's `TaxRateConfig`, at
 * `config/tax` — the admin-tunable GST-compliance rate/threshold doc (Phase
 * 11: TCS/TDS/e-way-bill). See functions/src/tax/taxConfig.ts for the
 * getter (falls back to `DEFAULT_TAX_CONFIG` when the doc doesn't exist yet,
 * same treatment as config/shipping).
 *
 * These figures are configuration, not constants, and change whenever GST
 * notifications or the Finance Act change — review with a chartered
 * accountant before go-live and before any production edit.
 */
export const taxConfigSchema = z.object({
  id: z.string().min(1),
  tcsRatePercent: z.number().min(0).max(100),
  tdsRatePercent: z.number().min(0).max(100),
  tdsIndividualHufExemptionThresholdPaise: paiseSchema,
  ewayBillThresholdPaise: paiseSchema,
  updatedAt: epochMsSchema,
})
export type TaxConfig = z.infer<typeof taxConfigSchema>

export const taxConfigConverter = makeFirestoreConverter(taxConfigSchema)
