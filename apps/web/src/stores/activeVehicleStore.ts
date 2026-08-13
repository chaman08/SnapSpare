import type { FuelType } from '@snapspare/shared'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ActiveVehicle {
  /**
   * Either a real GarageVehicle doc id (selected via the quick-switch bar or
   * "My Garage"), or a locally-derived id (see
   * features/catalog/lib/localVehicleId.ts) for a vehicle picked through
   * VehicleSelector that was never saved to the buyer's garage.
   */
  garageVehicleId: string
  makeId: string
  makeName: string
  modelId: string
  modelName: string
  variantId: string
  variantName: string
  /** Both optional because older/partial saves may predate these fields — checkFitment treats a missing year as "can't check". */
  year?: number
  fuelType?: FuelType
  nickname?: string
}

interface ActiveVehicleState {
  activeVehicle: ActiveVehicle | null
  setActiveVehicle: (vehicle: ActiveVehicle | null) => void
}

/**
 * The buyer's currently-selected garage vehicle, persisted so it survives a
 * refresh. Drives the persistent fitment bar globally (see FitmentBar /
 * AppShell) without every page needing to know about "My Garage".
 */
export const useActiveVehicleStore = create<ActiveVehicleState>()(
  persist(
    (set) => ({
      activeVehicle: null,
      setActiveVehicle: (vehicle) => set({ activeVehicle: vehicle }),
    }),
    { name: 'snapspare-active-vehicle' },
  ),
)
