import { DEFAULT_SHIPPING_CONFIG, type ShippingConfig, shippingConfigSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Reads `config/shipping` (the admin-tunable zone matrix/weight-slab/
 * oversized-handling model — design brief item 4), falling back to
 * `DEFAULT_SHIPPING_CONFIG` when the doc doesn't exist yet. Unlike
 * checkout/appConfig.ts's `getAppConfig` (which hard-fails on a missing
 * doc, because money config must never silently default), shipping has a
 * safe, already-shipped-with default — a missing config/shipping doc just
 * means no admin has customized it yet, not a misconfigured environment.
 */
export async function getShippingConfig(): Promise<ShippingConfig> {
  const snapshot = await getFirestore().collection('config').doc('shipping').get()
  if (!snapshot.exists) {
    return { id: 'shipping', ...DEFAULT_SHIPPING_CONFIG, updatedAt: 0 }
  }
  return shippingConfigSchema.parse({ id: snapshot.id, ...snapshot.data() })
}
