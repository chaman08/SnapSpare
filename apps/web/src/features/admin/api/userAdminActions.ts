import type {
  AdminSetUserFlagsRequest,
  AdminSetUserFlagsResult,
  StartImpersonationRequest,
  StartImpersonationResult,
  User,
} from '@snapspare/shared'
import { userConverter } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Users module search (design brief item 11): exact phone match, or the most recently created users. */
export function useAdminUsers(phoneFilter: string) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const base = collection(db, 'users').withConverter(clientConverter(userConverter))
    const q = phoneFilter.trim()
      ? query(base, where('phone', '==', phoneFilter.trim()))
      : query(base, orderBy('createdAt', 'desc'), limit(50))
    return onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [phoneFilter])

  return { users, loading }
}

const adminSetUserFlagsCallable = httpsCallable<AdminSetUserFlagsRequest, AdminSetUserFlagsResult>(functions, 'adminSetUserFlags')
export async function adminSetUserFlags(request: AdminSetUserFlagsRequest): Promise<AdminSetUserFlagsResult> {
  return (await adminSetUserFlagsCallable(request)).data
}

const startImpersonationCallable = httpsCallable<StartImpersonationRequest, StartImpersonationResult>(functions, 'startImpersonation')
export async function startImpersonation(request: StartImpersonationRequest): Promise<StartImpersonationResult> {
  return (await startImpersonationCallable(request)).data
}
