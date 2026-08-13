import { vehicleModelConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useVehicleMakes } from '@/features/auth/api/vehicleCatalog'
import { clientConverter } from '@/lib/firestoreConverter'

/**
 * Resolves a category page's vehicle-scoped URL segment (e.g.
 * "maruti-suzuki-swift" in /parts/brake/brake-pads/maruti-suzuki-swift) back
 * to a modelId. Make slugs can themselves contain hyphens, so this tries
 * each known make as a prefix of the combined slug rather than splitting on
 * the first/last hyphen — the first make whose slug is a genuine prefix and
 * whose remainder matches a real model under it wins.
 */
export function useResolveVehicleFromSlug(vehicleSlug: string | undefined) {
  const makesQuery = useVehicleMakes()

  return useQuery({
    queryKey: ['resolve-vehicle-slug', vehicleSlug, makesQuery.data?.map((m) => m.id).join(',')],
    queryFn: async () => {
      if (!vehicleSlug || !makesQuery.data) return null

      const candidateMakes = makesQuery.data
        .filter((make) => vehicleSlug === make.slug || vehicleSlug.startsWith(`${make.slug}-`))
        .sort((a, b) => b.slug.length - a.slug.length) // longest/most-specific make slug first

      for (const make of candidateMakes) {
        const modelSlug = vehicleSlug === make.slug ? '' : vehicleSlug.slice(make.slug.length + 1)
        if (!modelSlug) continue

        const snapshot = await getDocs(
          query(
            collection(db, 'vehicleModels').withConverter(clientConverter(vehicleModelConverter)),
            where('makeId', '==', make.id),
            where('slug', '==', modelSlug),
          ),
        )
        const model = snapshot.docs[0]?.data()
        if (model) return { make, model }
      }

      return null
    },
    enabled: Boolean(vehicleSlug) && !makesQuery.isLoading,
    staleTime: Infinity,
  })
}
