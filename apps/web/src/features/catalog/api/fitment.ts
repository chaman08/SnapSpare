import type { CheckFitmentResult, VehicleSelection } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import type { ActiveVehicle } from '@/stores/activeVehicleStore'

const checkFitmentCallable = httpsCallable<
  { partId: string; vehicle: VehicleSelection },
  CheckFitmentResult
>(functions, 'checkFitment')

/** Not every ActiveVehicle carries a year (see the comment on ActiveVehicle) — without one, checkFitment can't evaluate year ranges, so callers should treat this as "can't check" rather than call the function. */
export function toVehicleSelection(vehicle: ActiveVehicle): VehicleSelection | null {
  if (!vehicle.year) return null
  return {
    makeId: vehicle.makeId,
    modelId: vehicle.modelId,
    variantId: vehicle.variantId,
    year: vehicle.year,
    fuelType: vehicle.fuelType,
  }
}

/**
 * Resolves FITS / DOES_NOT_FIT / UNVERIFIED for one part against the active
 * vehicle, re-fetching (rather than relying on a cache from a previous
 * session) whenever the part or the active vehicle identity changes — this
 * is what "re-checked at cart load" (the cart guard) and per-render checks
 * on product cards/PDP rely on. Returns 'unverified' without a network call
 * when there's no active vehicle or it lacks a year.
 */
export function useFitmentCheck(partId: string, vehicle: ActiveVehicle | null) {
  const selection = vehicle ? toVehicleSelection(vehicle) : null

  return useQuery({
    queryKey: ['fitment-check', partId, selection],
    queryFn: async (): Promise<CheckFitmentResult> => {
      if (!selection) return { status: 'unverified' }
      const result = await checkFitmentCallable({ partId, vehicle: selection })
      return result.data
    },
    enabled: Boolean(partId),
    staleTime: 60_000,
  })
}
