import type { NotificationPreferences } from '@snapspare/shared'
import { notificationPreferencesConverter } from '@snapspare/shared'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

const DEFAULTS: Pick<NotificationPreferences, 'channels' | 'marketingOptOut'> = {
  channels: { push: true, sms: true, whatsapp: true, email: true },
  marketingOptOut: false,
}

interface UseNotificationPreferencesResult {
  channels: NotificationPreferences['channels']
  marketingOptOut: boolean
  loading: boolean
}

/** No preferences doc yet == every channel opted in, marketing not opted out — mirrors functions/src/notifications/preferences.ts's server-side default exactly. */
export function useNotificationPreferences(userId: string | undefined): UseNotificationPreferencesResult {
  const [channels, setChannels] = useState(DEFAULTS.channels)
  const [marketingOptOut, setMarketingOptOut] = useState(DEFAULTS.marketingOptOut)
  const [loading, setLoading] = useState(Boolean(userId))

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    return onSnapshot(
      doc(db, 'notificationPreferences', userId).withConverter(clientConverter(notificationPreferencesConverter)),
      (snapshot) => {
        const data = snapshot.data()
        setChannels(data?.channels ?? DEFAULTS.channels)
        setMarketingOptOut(data?.marketingOptOut ?? DEFAULTS.marketingOptOut)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [userId])

  return { channels, marketingOptOut, loading }
}
