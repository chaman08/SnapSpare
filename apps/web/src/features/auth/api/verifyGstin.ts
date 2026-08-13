import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

interface VerifyGstinResponse {
  status: 'pending' | 'invalid'
}

const verifyGstinCallable = httpsCallable<{ gstin: string }, VerifyGstinResponse>(
  functions,
  'verifyGstin',
)

export async function verifyGstin(gstin: string): Promise<VerifyGstinResponse> {
  const result = await verifyGstinCallable({ gstin })
  return result.data
}
