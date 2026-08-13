import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

interface PincodeLookupResponse {
  city: string
  state: string
  stateCode: string
}

const lookupPincodeCallable = httpsCallable<{ pincode: string }, PincodeLookupResponse>(
  functions,
  'lookupPincode',
)

export async function lookupPincode(pincode: string): Promise<PincodeLookupResponse | null> {
  try {
    const result = await lookupPincodeCallable({ pincode })
    return result.data
  } catch {
    return null
  }
}
