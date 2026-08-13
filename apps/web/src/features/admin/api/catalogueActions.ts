import type {
  AdminSaveCatalogPartRequest,
  AdminSaveCatalogPartResult,
  Brand,
  BulkImportCatalogPartsRequest,
  BulkImportCatalogPartsResult,
  CatalogPart,
  Category,
  SaveBrandRequest,
  SaveBrandResult,
  SaveCategoryRequest,
  SaveCategoryResult,
} from '@snapspare/shared'
import { brandConverter, catalogPartConverter, categoryConverter } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export function useCatalogParts(count = 100) {
  const [parts, setParts] = useState<CatalogPart[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'catalogParts').withConverter(clientConverter(catalogPartConverter)), orderBy('updatedAt', 'desc'), limit(count))
    return onSnapshot(q, (snapshot) => {
      setParts(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [count])

  return { parts, loading }
}

export function useBrands() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'brands').withConverter(clientConverter(brandConverter)), orderBy('name', 'asc'), limit(200))
    return onSnapshot(q, (snapshot) => {
      setBrands(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { brands, loading }
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'categories').withConverter(clientConverter(categoryConverter)), orderBy('name', 'asc'), limit(200))
    return onSnapshot(q, (snapshot) => {
      setCategories(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { categories, loading }
}

const adminSaveCatalogPartCallable = httpsCallable<AdminSaveCatalogPartRequest, AdminSaveCatalogPartResult>(functions, 'adminSaveCatalogPart')
export async function adminSaveCatalogPart(request: AdminSaveCatalogPartRequest): Promise<AdminSaveCatalogPartResult> {
  return (await adminSaveCatalogPartCallable(request)).data
}

const saveBrandCallable = httpsCallable<SaveBrandRequest, SaveBrandResult>(functions, 'saveBrand')
export async function saveBrand(request: SaveBrandRequest): Promise<SaveBrandResult> {
  return (await saveBrandCallable(request)).data
}

const saveCategoryCallable = httpsCallable<SaveCategoryRequest, SaveCategoryResult>(functions, 'saveCategory')
export async function saveCategory(request: SaveCategoryRequest): Promise<SaveCategoryResult> {
  return (await saveCategoryCallable(request)).data
}

const bulkImportCatalogPartsCallable = httpsCallable<BulkImportCatalogPartsRequest, BulkImportCatalogPartsResult>(
  functions,
  'bulkImportCatalogParts',
)
export async function bulkImportCatalogParts(request: BulkImportCatalogPartsRequest): Promise<BulkImportCatalogPartsResult> {
  return (await bulkImportCatalogPartsCallable(request)).data
}
