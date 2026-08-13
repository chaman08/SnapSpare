import type { Firestore } from 'firebase-admin/firestore'

/**
 * OEM-number duplicate detection shared by adminSaveCatalogPart.ts and
 * bulkImportCatalogParts.ts. Firestore's `array-contains-any` accepts at
 * most 10 values, so `oemNumbers` is chunked; `excludePartId` lets an update
 * skip matching against itself. Only `status == 'active'` parts count as a
 * real duplicate — a part someone already deactivated isn't a collision.
 */
export async function findDuplicateCatalogParts(
  db: Firestore,
  oemNumbers: string[],
  excludePartId?: string,
): Promise<string[]> {
  const chunks: string[][] = []
  for (let i = 0; i < oemNumbers.length; i += 10) chunks.push(oemNumbers.slice(i, i + 10))

  const matchedIds = new Set<string>()
  for (const chunk of chunks) {
    if (chunk.length === 0) continue
    const snapshot = await db
      .collection('catalogParts')
      .where('oemNumbers', 'array-contains-any', chunk)
      .where('status', '==', 'active')
      .get()
    for (const doc of snapshot.docs) {
      if (doc.id !== excludePartId) matchedIds.add(doc.id)
    }
  }
  return Array.from(matchedIds)
}
