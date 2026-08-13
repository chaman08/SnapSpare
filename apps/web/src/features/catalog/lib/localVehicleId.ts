/**
 * Stable id for a vehicle picked through VehicleSelector that was never
 * saved to the buyer's Firestore garage — lets ActiveVehicle.garageVehicleId
 * stay a plain required string (see stores/activeVehicleStore.ts) without
 * every "active vehicle" needing a real GarageVehicle doc behind it.
 * Re-picking the same make/model/variant/year yields the same id.
 */
export function localVehicleId(makeId: string, modelId: string, variantId: string, year: number): string {
  return `local:${makeId}:${modelId}:${variantId}:${year}`
}
