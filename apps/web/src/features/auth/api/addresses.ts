import type { Address } from '@snapspare/shared'
import { addressConverter } from '@snapspare/shared'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  addDoc as firestoreAddDoc,
  updateDoc as firestoreUpdateDoc,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

function addressesCollection(userId: string) {
  return collection(db, 'users', userId, 'addresses').withConverter(clientConverter(addressConverter))
}

/** Live-subscribes to a buyer's address book, newest first. */
export function useAddresses(userId: string | undefined) {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!userId) {
      setAddresses([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(addressesCollection(userId), orderBy('createdAt', 'desc'))
    return onSnapshot(
      q,
      (snapshot) => {
        setAddresses(snapshot.docs.map((d) => d.data()))
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
  }, [userId])

  return { addresses, loading, error }
}

export type AddressInput = Omit<Address, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDefault'>

/** Returns the new address's id so callers that need to immediately select it (e.g. checkout's "add new" inline flow) don't have to wait for the live subscription to catch up. */
export async function addAddress(userId: string, input: AddressInput): Promise<string> {
  const now = Date.now()
  const ref = await firestoreAddDoc(collection(db, 'users', userId, 'addresses'), {
    ...input,
    userId,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  })
  return ref.id
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: AddressInput,
): Promise<void> {
  await firestoreUpdateDoc(doc(db, 'users', userId, 'addresses', addressId), {
    ...input,
    updatedAt: Date.now(),
  })
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'addresses', addressId))
}

/** Unsets the previous default (if any) and sets the new one, atomically. */
export async function setDefaultAddress(userId: string, addressId: string): Promise<void> {
  const addressesRef = collection(db, 'users', userId, 'addresses')
  // Transaction.get() only accepts a DocumentReference, not a Query, so the
  // list is read up front and only the targeted writes go through the transaction.
  const snapshot = await getDocs(addressesRef)
  await runTransaction(db, async (tx) => {
    for (const docSnap of snapshot.docs) {
      const isTarget = docSnap.id === addressId
      const current = docSnap.data().isDefault === true
      if (isTarget !== current) {
        tx.update(docSnap.ref, { isDefault: isTarget, updatedAt: Date.now() })
      }
    }
  })
}
