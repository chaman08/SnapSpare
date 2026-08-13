import type { VehicleRegLookupResult } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const lookupVehicleByRegCallable = httpsCallable<{ regNumber: string }, VehicleRegLookupResult>(
  functions,
  'lookupVehicleByReg',
)

/** Maps the callable's HttpsError codes to i18next keys under `vehicleRegLookup.errors`. */
export function mapVehicleRegLookupErrorToI18nKey(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? ''

  switch (code) {
    case 'functions/resource-exhausted':
      return 'vehicleRegLookup.errors.rateLimited'
    case 'functions/invalid-argument':
      return 'vehicleRegLookup.errors.invalid'
    case 'functions/unauthenticated':
      return 'vehicleRegLookup.errors.signInRequired'
    default:
      return 'vehicleRegLookup.errors.generic'
  }
}

export async function lookupVehicleByReg(regNumber: string): Promise<VehicleRegLookupResult> {
  const result = await lookupVehicleByRegCallable({ regNumber })
  return result.data
}
