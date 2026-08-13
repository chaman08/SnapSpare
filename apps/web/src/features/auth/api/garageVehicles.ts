import type { GarageVehicle } from '@snapspare/shared'
import { garageVehicleConverter } from '@snapspare/shared'
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
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

function garageCollection(userId: string) {
  return collection(db, 'users', userId, 'vehicles').withConverter(
    clientConverter(garageVehicleConverter),
  )
}

export function useGarageVehicles(userId: string | undefined) {
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!userId) {
      setVehicles([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(garageCollection(userId), orderBy('createdAt', 'desc'))
    return onSnapshot(
      q,
      (snapshot) => {
        setVehicles(snapshot.docs.map((d) => d.data()))
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
  }, [userId])

  return { vehicles, loading, error }
}

export type GarageVehicleInput = Omit<
  GarageVehicle,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isPrimary'
>

export async function addGarageVehicle(userId: string, input: GarageVehicleInput): Promise<void> {
  const now = Date.now()
  await firestoreAddDoc(collection(db, 'users', userId, 'vehicles'), {
    ...input,
    userId,
    isPrimary: false,
    createdAt: now,
    updatedAt: now,
  })
}

export async function deleteGarageVehicle(userId: string, vehicleId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'vehicles', vehicleId))
}

/** Unsets the previous primary vehicle (if any) and sets the new one, atomically. */
export async function setPrimaryGarageVehicle(userId: string, vehicleId: string): Promise<void> {
  const vehiclesRef = collection(db, 'users', userId, 'vehicles')
  // Transaction.get() only accepts a DocumentReference, not a Query, so the
  // list is read up front and only the targeted writes go through the transaction.
  const snapshot = await getDocs(vehiclesRef)
  await runTransaction(db, async (tx) => {
    for (const docSnap of snapshot.docs) {
      const isTarget = docSnap.id === vehicleId
      const current = docSnap.data().isPrimary === true
      if (isTarget !== current) {
        tx.update(docSnap.ref, { isPrimary: isTarget, updatedAt: Date.now() })
      }
    }
  })
}
