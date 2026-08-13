import type { RegisterDeviceFingerprintRequest } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { computeDeviceFingerprint } from '@/lib/deviceFingerprint'
import { functions } from '@/lib/firebase'

const registerDeviceFingerprintCallable = httpsCallable<RegisterDeviceFingerprintRequest, { ok: true }>(
  functions,
  'registerDeviceFingerprint',
)

/** Computes and registers this browser's device fingerprint against the signed-in account — see AuthProvider.tsx's call site and functions/src/abuse/registerDeviceFingerprint.ts for why. */
export async function registerDeviceFingerprint(): Promise<void> {
  const fingerprint = await computeDeviceFingerprint()
  await registerDeviceFingerprintCallable({ fingerprint })
}
