import type { VehicleRegLookupResult } from '@snapspare/shared'

/**
 * Adapter boundary for "resolve a registration number to a vehicle".
 * `lookupVehicleByReg.ts` depends only on this interface, so swapping the
 * mock (see mockRegLookupProvider.ts) for a real licensed data provider in
 * production is a one-line change there, not a rewrite of the callable.
 */
export interface VehicleRegLookupProvider {
  lookup(regNumber: string): Promise<Omit<VehicleRegLookupResult, 'regNumber'>>
}
