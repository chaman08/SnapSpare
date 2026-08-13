import type { CmsPage } from '@snapspare/shared'
import { cmsPageConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/**
 * Phase 24: public read of a single published policy/FAQ page by slug (doc
 * id == slug, same convention seedLegalContent.ts writes). A single `get()`
 * only has to satisfy firestore.rules against the actual resource, so no
 * explicit `status == 'published'` filter is needed here the way a list
 * query would — a draft page simply resolves to `null` for a signed-out
 * reader instead of throwing, exactly like any other not-found doc.
 */
export function useCmsPageBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['cms-page', slug],
    queryFn: async (): Promise<CmsPage | null> => {
      if (!slug) return null
      const snapshot = await getDoc(doc(db, 'cmsPages', slug).withConverter(clientConverter(cmsPageConverter)))
      if (!snapshot.exists() || snapshot.data().status !== 'published') return null
      return snapshot.data()
    },
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  })
}

/**
 * Public Help Centre listing — unlike the single-doc read above, this is a
 * collection query, so firestore.rules' query-shape validation requires the
 * `status == 'published'` filter to be explicit in the query itself (not
 * just checked client-side) for a signed-out/non-admin reader to be allowed
 * to run it at all.
 */
export function useFaqArticles() {
  return useQuery({
    queryKey: ['cms-faq-articles'],
    queryFn: async (): Promise<CmsPage[]> => {
      const q = query(
        collection(db, 'cmsPages').withConverter(clientConverter(cmsPageConverter)),
        where('type', '==', 'faq'),
        where('status', '==', 'published'),
      )
      const snapshot = await getDocs(q)
      return snapshot.docs.map((d) => d.data())
    },
    staleTime: 5 * 60_000,
  })
}
