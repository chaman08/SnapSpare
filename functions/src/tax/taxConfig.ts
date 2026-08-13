import { DEFAULT_TAX_CONFIG, type TaxConfig, taxConfigSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Reads `config/tax` (GST-compliance rates/thresholds — design brief Phase
 * 11), falling back to `DEFAULT_TAX_CONFIG` when no admin has customized it
 * yet. Same treatment as shipping/shippingConfig.ts's `getShippingConfig` —
 * a missing doc is a normal, safe state, not a misconfiguration.
 *
 * These figures are configuration, not constants, and must be reviewed with
 * a chartered accountant before go-live and before any production change —
 * see the README's "Tax compliance" section.
 */
export async function getTaxConfig(): Promise<TaxConfig> {
  const snapshot = await getFirestore().collection('config').doc('tax').get()
  if (!snapshot.exists) {
    return { id: 'tax', ...DEFAULT_TAX_CONFIG, updatedAt: 0 }
  }
  return taxConfigSchema.parse({ id: snapshot.id, ...snapshot.data() })
}
