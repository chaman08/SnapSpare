import type {
  CmsPage,
  SaveCmsPageRequest,
  SaveCmsPageResult,
  SetStringOverrideRequest,
  SetStringOverrideResult,
  StringOverride,
} from '@snapspare/shared'
import { cmsPageConverter, stringOverrideConverter } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export function useCmsPages() {
  const [pages, setPages] = useState<CmsPage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'cmsPages').withConverter(clientConverter(cmsPageConverter)), orderBy('updatedAt', 'desc'), limit(100))
    return onSnapshot(q, (snapshot) => {
      setPages(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { pages, loading }
}

export function useStringOverrides() {
  const [overrides, setOverrides] = useState<StringOverride[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'stringOverrides').withConverter(clientConverter(stringOverrideConverter)), orderBy('key', 'asc'), limit(200))
    return onSnapshot(q, (snapshot) => {
      setOverrides(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { overrides, loading }
}

const saveCmsPageCallable = httpsCallable<SaveCmsPageRequest, SaveCmsPageResult>(functions, 'saveCmsPage')
export async function saveCmsPage(request: SaveCmsPageRequest): Promise<SaveCmsPageResult> {
  return (await saveCmsPageCallable(request)).data
}

const setStringOverrideCallable = httpsCallable<SetStringOverrideRequest, SetStringOverrideResult>(functions, 'setStringOverride')
export async function setStringOverride(request: SetStringOverrideRequest): Promise<SetStringOverrideResult> {
  return (await setStringOverrideCallable(request)).data
}
