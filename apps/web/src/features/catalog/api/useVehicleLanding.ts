import { vehicleMakeConverter, vehicleModelConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/**
 * Resolves /vehicle/:makeSlug/:modelSlug/:year (Phase 22 requirement 1) —
 * unlike useResolveVehicleFromSlug (which reverse-engineers a combined
 * `${make}-${model}` segment for the older vehicle-scoped category URL),
 * this route already has make and model as separate segments, so it's a
 * direct two-query lookup. `year` isn't itself a Firestore field (fitment is
 * modelled at the model level, spanning yearFrom..yearTo — see
 * vehicleModel.ts) — it's validated against that range client-side, not
 * looked up.
 */
export function useVehicleLanding(makeSlug: string | undefined, modelSlug: string | undefined, year: string | undefined) {
  return useQuery({
    queryKey: ['vehicle-landing', makeSlug, modelSlug, year],
    queryFn: async () => {
      if (!makeSlug || !modelSlug) return null

      const makeSnapshot = await getDocs(
        query(
          collection(db, 'vehicleMakes').withConverter(clientConverter(vehicleMakeConverter)),
          where('slug', '==', makeSlug),
        ),
      )
      const make = makeSnapshot.docs[0]?.data()
      if (!make) return null

      const modelSnapshot = await getDocs(
        query(
          collection(db, 'vehicleModels').withConverter(clientConverter(vehicleModelConverter)),
          where('makeId', '==', make.id),
          where('slug', '==', modelSlug),
        ),
      )
      const model = modelSnapshot.docs[0]?.data()
      if (!model) return null

      const yearNum = year ? Number.parseInt(year, 10) : undefined
      const yearInRange =
        yearNum === undefined || Number.isNaN(yearNum)
          ? undefined
          : yearNum >= model.yearFrom && yearNum <= (model.yearTo ?? new Date().getFullYear() + 1)

      return { make, model, yearNum, yearInRange }
    },
    enabled: Boolean(makeSlug && modelSlug),
    staleTime: Infinity,
  })
}
