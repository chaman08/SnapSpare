import type { NotificationDeadLetter } from '@snapspare/shared'
import { notificationDeadLetterConverter } from '@snapspare/shared'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Admin-only: unresolved notificationsDeadLetter rows, newest first — see firestore.rules (isAdmin() read, no client write). */
export function useUnresolvedDeadLetters() {
  const [deadLetters, setDeadLetters] = useState<NotificationDeadLetter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'notificationsDeadLetter').withConverter(clientConverter(notificationDeadLetterConverter)),
      where('resolved', '==', false),
      orderBy('failedAt', 'desc'),
      limit(200),
    )
    return onSnapshot(q, (snapshot) => {
      setDeadLetters(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { deadLetters, loading }
}
