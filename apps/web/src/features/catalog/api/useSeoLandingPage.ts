import { seoLandingPageConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Doc id convention shared with functions/src/marketing/generateSeoLandingPages.ts — see that file's header comment. */
export function seoLandingPageId(categorySlug: string, subCategorySlug: string | undefined, vehicleSlug: string): string {
  return `${categorySlug}__${subCategorySlug ?? 'all'}__${vehicleSlug}`
}

/**
 * Looks up the auto-generated long-tail SEO copy for a vehicle-scoped
 * category page (Phase 22 requirement 1 — "brake pads for Maruti Swift 2018
 * diesel"). Absence isn't an error: only combinations that cleared the
 * quality bar (see generateSeoLandingPages.ts) get a doc — the page still
 * renders and stays crawlable without one, just with generic copy instead
 * of a tailored title/FAQ.
 */
export function useSeoLandingPage(categorySlug: string | undefined, subCategorySlug: string | undefined, vehicleSlug: string | undefined) {
  return useQuery({
    queryKey: ['seo-landing-page', categorySlug, subCategorySlug, vehicleSlug],
    queryFn: async () => {
      if (!categorySlug || !vehicleSlug) return null
      const snapshot = await getDoc(
        doc(db, 'seoLandingPages', seoLandingPageId(categorySlug, subCategorySlug, vehicleSlug)).withConverter(
          clientConverter(seoLandingPageConverter),
        ),
      )
      return snapshot.exists() ? snapshot.data() : null
    },
    enabled: Boolean(categorySlug && vehicleSlug),
    staleTime: 5 * 60_000,
  })
}
