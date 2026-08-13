import { vehicleMakeConverter, vehicleModelConverter, vehicleVariantConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/**
 * vehicleMakes/vehicleModels/vehicleVariants are flat top-level collections
 * (each model/variant carries its parent id as a field — `makeId`/`modelId`
 * — rather than living in a subcollection), matching how the seed script
 * writes them and how firestore.rules gates them. This data barely ever
 * changes, so staleTime: Infinity is deliberate — a hard refresh (or a
 * manual query invalidation, if the vehicle master data is ever edited) is
 * the only way this refetches within a session.
 */
export function useVehicleMakes() {
  return useQuery({
    queryKey: ['vehicle-makes'],
    queryFn: async () => {
      const snapshot = await getDocs(
        query(
          collection(db, 'vehicleMakes').withConverter(clientConverter(vehicleMakeConverter)),
          where('status', '==', 'active'),
          orderBy('name'),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    staleTime: Infinity,
  })
}

export function useVehicleModels(makeId: string | undefined) {
  return useQuery({
    queryKey: ['vehicle-models', makeId],
    queryFn: async () => {
      if (!makeId) return []
      const snapshot = await getDocs(
        query(
          collection(db, 'vehicleModels').withConverter(clientConverter(vehicleModelConverter)),
          where('makeId', '==', makeId),
          where('status', '==', 'active'),
          orderBy('name'),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    enabled: Boolean(makeId),
    staleTime: Infinity,
  })
}

export function useVehicleVariants(makeId: string | undefined, modelId: string | undefined) {
  return useQuery({
    queryKey: ['vehicle-variants', makeId, modelId],
    queryFn: async () => {
      if (!makeId || !modelId) return []
      const snapshot = await getDocs(
        query(
          collection(db, 'vehicleVariants').withConverter(clientConverter(vehicleVariantConverter)),
          where('modelId', '==', modelId),
          where('status', '==', 'active'),
          orderBy('name'),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    enabled: Boolean(makeId && modelId),
    staleTime: Infinity,
  })
}
