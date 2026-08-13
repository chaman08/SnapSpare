import type { BrandAuthorization, SubmitBrandAuthorizationRequest } from '@snapspare/shared'
import { brandAuthorizationConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { ref, uploadBytes } from 'firebase/storage'
import { useEffect, useState } from 'react'
import { compressImageIfNeeded } from '@/features/sellerOnboarding/lib/compressImage'
import { db, functions, storage } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Seller's own brand-authorization submissions, newest first — same storage-rule read the seller already has (isSeller(sellerId)) covers a direct client fetch here, unlike spurious-report evidence. */
export function useMyBrandAuthorizations(sellerId: string | undefined) {
  const [authorizations, setAuthorizations] = useState<BrandAuthorization[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sellerId) {
      setAuthorizations([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, 'brandAuthorizations').withConverter(clientConverter(brandAuthorizationConverter)),
      where('sellerId', '==', sellerId),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, (snapshot) => {
      setAuthorizations(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [sellerId])

  return { authorizations, loading }
}

/** Uploaded to `sellers/{sellerId}/brandAuthorizations/...`, readable by the owning seller/admin directly (see storage.rules) — the document, not just its path, since the seller needs to review what they submitted while pending. */
export async function uploadBrandAuthorizationDocument(sellerId: string, file: File): Promise<string> {
  const compressed = await compressImageIfNeeded(file)
  const path = `sellers/${sellerId}/brandAuthorizations/${Date.now()}-${compressed.name}`
  await uploadBytes(ref(storage, path), compressed)
  return path
}

const submitBrandAuthorizationCallable = httpsCallable<SubmitBrandAuthorizationRequest, { id: string }>(
  functions,
  'submitBrandAuthorization',
)

export const submitBrandAuthorization = (request: SubmitBrandAuthorizationRequest) =>
  submitBrandAuthorizationCallable(request).then((r) => r.data)
