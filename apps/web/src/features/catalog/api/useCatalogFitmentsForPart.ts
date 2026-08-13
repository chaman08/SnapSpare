import {
  catalogFitmentConverter,
  vehicleMakeConverter,
  vehicleModelConverter,
  vehicleVariantConverter,
} from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export interface FitmentRow {
  id: string
  makeName: string
  modelName: string
  variantName?: string
  yearFrom?: number
  yearTo?: number
}

/**
 * Resolves catalogFitments -> readable make/model/variant names for the
 * Fitment tab's searchable table. Fitment lists per part are small (tens of
 * rows, not thousands), so this fetches each referenced make/model/variant
 * doc individually rather than adding another chunked `in`-query batching
 * layer — simplicity over a micro-optimisation that wouldn't be felt here.
 */
export function useCatalogFitmentsForPart(partId: string | undefined) {
  return useQuery({
    queryKey: ['catalog-fitments-for-part', partId],
    queryFn: async (): Promise<FitmentRow[]> => {
      if (!partId) return []

      const fitmentSnapshot = await getDocs(
        query(
          collection(db, 'catalogFitments').withConverter(clientConverter(catalogFitmentConverter)),
          where('partId', '==', partId),
        ),
      )
      const fitments = fitmentSnapshot.docs.map((d) => d.data())
      if (fitments.length === 0) return []

      const makeIds = Array.from(new Set(fitments.map((f) => f.makeId)))
      const modelIds = Array.from(new Set(fitments.map((f) => f.modelId)))
      const variantIds = Array.from(new Set(fitments.map((f) => f.variantId).filter((id): id is string => Boolean(id))))

      const [makeDocs, modelDocs, variantDocs] = await Promise.all([
        Promise.all(makeIds.map((id) => getDoc(doc(db, 'vehicleMakes', id).withConverter(clientConverter(vehicleMakeConverter))))),
        Promise.all(modelIds.map((id) => getDoc(doc(db, 'vehicleModels', id).withConverter(clientConverter(vehicleModelConverter))))),
        Promise.all(variantIds.map((id) => getDoc(doc(db, 'vehicleVariants', id).withConverter(clientConverter(vehicleVariantConverter))))),
      ])

      const makeNames = new Map(makeDocs.filter((s) => s.exists()).map((s) => [s.id, s.data()!.name]))
      const modelNames = new Map(modelDocs.filter((s) => s.exists()).map((s) => [s.id, s.data()!.name]))
      const variantNames = new Map(variantDocs.filter((s) => s.exists()).map((s) => [s.id, s.data()!.name]))

      return fitments.map((fitment) => ({
        id: fitment.id,
        makeName: makeNames.get(fitment.makeId) ?? fitment.makeId,
        modelName: modelNames.get(fitment.modelId) ?? fitment.modelId,
        variantName: fitment.variantId ? variantNames.get(fitment.variantId) : undefined,
        yearFrom: fitment.yearFrom,
        yearTo: fitment.yearTo,
      }))
    },
    enabled: Boolean(partId),
    staleTime: 60_000,
  })
}
