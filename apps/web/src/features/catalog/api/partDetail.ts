import { catalogPartConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** The product detail page's master-data read — same doc shown across every listing of this part. */
export function usePartDetail(partId: string | undefined) {
  return useQuery({
    queryKey: ['catalog-part', partId],
    queryFn: async () => {
      if (!partId) return null
      const snapshot = await getDoc(
        doc(db, 'catalogParts', partId).withConverter(clientConverter(catalogPartConverter)),
      )
      return snapshot.exists() ? snapshot.data() : null
    },
    enabled: Boolean(partId),
    staleTime: 60_000,
  })
}
