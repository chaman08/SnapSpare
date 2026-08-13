import type { CheckPickupPincodeServiceabilityResult } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const checkPickupPincodeServiceabilityCallable = httpsCallable<
  { pincode: string },
  CheckPickupPincodeServiceabilityResult
>(functions, 'checkPickupPincodeServiceability')

export async function checkPickupPincodeServiceability(
  pincode: string,
): Promise<CheckPickupPincodeServiceabilityResult> {
  const result = await checkPickupPincodeServiceabilityCallable({ pincode })
  return result.data
}
