import type { Firestore } from 'firebase-admin/firestore'

/** See adminSaveCatalogFitmentRequestSchema's header comment for exactly what "conflict" means here (an exact duplicate tuple, not an exclusivity rule). */
export async function findConflictingFitments(
  db: Firestore,
  input: { partId: string; makeId: string; modelId: string; variantId?: string },
  excludeFitmentId?: string,
): Promise<string[]> {
  const snapshot = await db
    .collection('catalogFitments')
    .where('partId', '==', input.partId)
    .where('makeId', '==', input.makeId)
    .where('modelId', '==', input.modelId)
    .get()
  const matches = snapshot.docs.filter((doc) => {
    if (doc.id === excludeFitmentId) return false
    const data = doc.data()
    return (data.variantId as string | undefined) === input.variantId
  })
  return matches.map((doc) => doc.id)
}
