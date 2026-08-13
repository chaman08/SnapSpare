import type { AuditLog } from '@snapspare/shared'
import { auditLogConverter } from '@snapspare/shared'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Audit Log viewer (design brief: role-gated access + audit log on every mutating action) — live trail of writeAuditLog() entries, optionally filtered to one target type or actor. */
export function useAuditLog(targetTypeFilter: string, actorIdFilter: string, count = 100) {
  const [entries, setEntries] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const base = collection(db, 'auditLogs').withConverter(clientConverter(auditLogConverter))
    const q = targetTypeFilter.trim()
      ? query(base, where('targetType', '==', targetTypeFilter.trim()), orderBy('createdAt', 'desc'), limit(count))
      : actorIdFilter.trim()
        ? query(base, where('actorId', '==', actorIdFilter.trim()), orderBy('createdAt', 'desc'), limit(count))
        : query(base, orderBy('createdAt', 'desc'), limit(count))
    return onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [targetTypeFilter, actorIdFilter, count])

  return { entries, loading }
}
