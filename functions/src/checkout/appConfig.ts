import { type Config, configSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'

/** Throws (rather than defaulting) when config/app is missing — unlike checkServiceability's best-effort read, createOrder/releaseExpiredReservations touch money and must fail loudly on a misconfigured environment instead of silently using fallback values. */
export async function getAppConfig(): Promise<Config> {
  const snapshot = await getFirestore().collection('config').doc('app').get()
  if (!snapshot.exists) {
    throw new Error('config/app document is missing')
  }
  return configSchema.parse({ id: snapshot.id, ...snapshot.data() })
}
