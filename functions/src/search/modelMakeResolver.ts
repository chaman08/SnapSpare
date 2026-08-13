import type { Firestore } from 'firebase-admin/firestore'

const CHUNK_SIZE = 300 // getAll() caps around ~500 refs per call; stay comfortably under it.

/**
 * Batch-resolves vehicleModelId -> vehicleMakeId for a set of model ids
 * (a search document's `makeIds` facet is derived from its part's
 * `fitmentSummary.modelIds`, but only the make id is denormalized there).
 * Returns a plain lookup function so callers don't need to know it's backed
 * by a Map.
 */
export async function buildModelMakeResolver(
  db: Firestore,
  modelIds: string[],
): Promise<(modelId: string) => string | undefined> {
  const uniqueIds = Array.from(new Set(modelIds))
  const map = new Map<string, string>()

  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + CHUNK_SIZE)
    if (chunk.length === 0) continue
    const refs = chunk.map((id) => db.collection('vehicleModels').doc(id))
    const snapshots = await db.getAll(...refs)
    for (const snapshot of snapshots) {
      const makeId = snapshot.exists ? (snapshot.data()?.makeId as string | undefined) : undefined
      if (makeId) map.set(snapshot.id, makeId)
    }
  }

  return (modelId: string) => map.get(modelId)
}
