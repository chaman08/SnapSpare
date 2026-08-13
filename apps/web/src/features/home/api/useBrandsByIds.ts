import type { Brand } from '@snapspare/shared'
import { brandConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, documentId, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Brand rail (Phase 20). `brandIds` is capped at 20 by homeSectionSchema, well under Firestore's 30-value `in` limit, so this never needs chunking. */
export function useBrandsByIds(brandIds: string[]) {
  return useQuery({
    queryKey: ['home-brands-by-ids', brandIds],
    queryFn: async (): Promise<Brand[]> => {
      if (brandIds.length === 0) return []
      const snapshot = await getDocs(
        query(collection(db, 'brands').withConverter(clientConverter(brandConverter)), where(documentId(), 'in', brandIds)),
      )
      const byId = new Map(snapshot.docs.map((d) => [d.id, d.data()]))
      return brandIds.map((id) => byId.get(id)).filter((brand): brand is Brand => Boolean(brand))
    },
    enabled: brandIds.length > 0,
    staleTime: 5 * 60_000,
  })
}
