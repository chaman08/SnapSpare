import type {
  AdminSaveCatalogFitmentRequest,
  AdminSaveCatalogFitmentResult,
  BulkImportCatalogFitmentsRequest,
  BulkImportCatalogFitmentsResult,
  CatalogFitment,
} from '@snapspare/shared'
import { catalogFitmentConverter } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Fitment workbench search: by exact partId or exact modelId (no fuzzy/name search — see the module's left-out note). */
export function useFitmentSearch() {
  const [rows, setRows] = useState<CatalogFitment[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function search(field: 'partId' | 'modelId', value: string) {
    setLoading(true)
    setSearched(true)
    try {
      const snapshot = await getDocs(
        query(
          collection(db, 'catalogFitments').withConverter(clientConverter(catalogFitmentConverter)),
          where(field, '==', value.trim()),
          limit(100),
        ),
      )
      setRows(snapshot.docs.map((d) => d.data()))
    } finally {
      setLoading(false)
    }
  }

  return { rows, loading, searched, search }
}

const adminSaveCatalogFitmentCallable = httpsCallable<AdminSaveCatalogFitmentRequest, AdminSaveCatalogFitmentResult>(
  functions,
  'adminSaveCatalogFitment',
)
export async function adminSaveCatalogFitment(request: AdminSaveCatalogFitmentRequest): Promise<AdminSaveCatalogFitmentResult> {
  return (await adminSaveCatalogFitmentCallable(request)).data
}

const bulkImportCatalogFitmentsCallable = httpsCallable<BulkImportCatalogFitmentsRequest, BulkImportCatalogFitmentsResult>(
  functions,
  'bulkImportCatalogFitments',
)
export async function bulkImportCatalogFitments(request: BulkImportCatalogFitmentsRequest): Promise<BulkImportCatalogFitmentsResult> {
  return (await bulkImportCatalogFitmentsCallable(request)).data
}
