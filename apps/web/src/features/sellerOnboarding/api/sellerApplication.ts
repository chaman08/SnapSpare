import type {
  SellerApplication,
  SellerApplicationAddress,
  SellerApplicationBank,
  SellerApplicationBusiness,
  SellerApplicationDocuments,
  SellerApplicationPickupAddress,
  SellerApplicationTaxIdentity,
  SubmitSellerApplicationResult,
} from '@snapspare/shared'
import { sellerApplicationConverter, SELLER_AGREEMENT_VERSION } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

function applicationDocRef(uid: string) {
  return doc(db, 'sellerApplications', uid)
}

/** Live-subscribes to the signed-in owner's own draft/submitted application (id == uid). `undefined` means still loading, `null` means no application has been started yet. */
export function useSellerApplication(uid: string | undefined) {
  const [application, setApplication] = useState<SellerApplication | null | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!uid) {
      setApplication(null)
      return
    }
    setApplication(undefined)
    return onSnapshot(
      doc(db, 'sellerApplications', uid).withConverter(clientConverter(sellerApplicationConverter)),
      (snapshot) => {
        setApplication(snapshot.exists() ? snapshot.data() : null)
        setError(null)
      },
      (err) => setError(err),
    )
  }, [uid])

  return { application, loading: application === undefined, error }
}

interface StepSavePayload {
  business?: SellerApplicationBusiness
  taxIdentity?: SellerApplicationTaxIdentity
  registeredAddress?: SellerApplicationAddress
  pickupAddresses?: SellerApplicationPickupAddress[]
  bank?: SellerApplicationBank
  documents?: SellerApplicationDocuments
  currentStep?: number
}

/**
 * Direct rules-guarded save (merge) for one wizard step's data — no callable
 * round-trip, so saving feels instant. Plain `setDoc(..., { merge: true })`
 * without `.withConverter()`, the same way profile.ts's updateBuyerProfile
 * does partial writes: the shared converter's `toFirestore` only has a
 * full-model signature, which fights a partial/merge write's typing.
 * Creates the draft doc on first use (`existingStatus === undefined`).
 */
export async function saveSellerApplicationStep(
  uid: string,
  existingStatus: SellerApplication['status'] | undefined,
  payload: StepSavePayload,
): Promise<void> {
  const now = Date.now()
  const base = existingStatus === undefined
    ? { ownerUserId: uid, status: 'draft' as const, currentStep: 1, pickupAddresses: [], documents: {}, reviewNotes: [], createdAt: now }
    : {}

  await setDoc(applicationDocRef(uid), { ...base, ...payload, updatedAt: now }, { merge: true })
}

const submitSellerApplicationCallable = httpsCallable<{ accepted: true; version: string }, SubmitSellerApplicationResult>(
  functions,
  'submitSellerApplication',
)

/** Flips draft/changes_requested -> submitted; server re-validates completeness and records the agreement's timestamp + IP. */
export async function submitSellerApplication(): Promise<SubmitSellerApplicationResult> {
  const result = await submitSellerApplicationCallable({ accepted: true, version: SELLER_AGREEMENT_VERSION })
  return result.data
}
