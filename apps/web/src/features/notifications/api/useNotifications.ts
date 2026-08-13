import type { Notification } from '@snapspare/shared'
import { notificationConverter } from '@snapspare/shared'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

const PAGE_SIZE = 50

interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: Error | null
}

/** Live-subscribes to the signed-in user's 50 most recent notifications — the in-app notification centre reads this collection directly, no separate feed/template needed (see schemas/notification.ts). */
export function useNotifications(userId: string | undefined): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'notificationsQueue').withConverter(clientConverter(notificationConverter)),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setNotifications(snapshot.docs.map((d) => d.data()))
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
  }, [userId])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  return { notifications, unreadCount, loading, error }
}
