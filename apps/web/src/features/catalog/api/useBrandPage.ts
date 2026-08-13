import { brandConverter, catalogPartConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export function useBrandBySlug(brandSlug: string | undefined) {
  return useQuery({
    queryKey: ['brand-by-slug', brandSlug],
    queryFn: async () => {
      if (!brandSlug) return null
      const snapshot = await getDocs(
        query(
          collection(db, 'brands').withConverter(clientConverter(brandConverter)),
          where('slug', '==', brandSlug),
          where('status', '==', 'active'),
        ),
      )
      return snapshot.docs[0]?.data() ?? null
    },
    enabled: Boolean(brandSlug),
    staleTime: 5 * 60_000,
  })
}

const BRAND_PARTS_LIMIT = 24

/**
 * Queries `catalogParts` directly by the brand's free-text `brand` field
 * (see catalogPart.ts's schema comment — brand is a plain string, not a
 * brandId reference, a pre-existing modelling choice this phase doesn't
 * change) rather than through Typesense — the listings search index has no
 * brand facet today. Good enough for a first version of this new page;
 * wiring a real brand facet into search/buildSearchDocument.ts (so this page
 * can show live price/stock per offer instead of master-part cards) is the
 * natural follow-up, not built here — see the Phase 22 README note.
 */
export function useBrandParts(brandName: string | undefined) {
  return useQuery({
    queryKey: ['brand-parts', brandName],
    queryFn: async () => {
      if (!brandName) return []
      const snapshot = await getDocs(
        query(
          collection(db, 'catalogParts').withConverter(clientConverter(catalogPartConverter)),
          where('brand', '==', brandName),
          where('status', '==', 'active'),
          orderBy('ratingBayesian', 'desc'),
          limit(BRAND_PARTS_LIMIT),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    enabled: Boolean(brandName),
    staleTime: 60_000,
  })
}
