import type { Config } from '@snapspare/shared'
import { configConverter } from '@snapspare/shared'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to the public config/app singleton — checkout reads razorpayKeyId, codEnabled/codCapPaise/codFeePaise, and emiThresholdPaise from it. Publicly readable (see firestore.rules), so this never gates on auth. */
export function useAppConfig(): { config: Config | null; loading: boolean } {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'config', 'app').withConverter(clientConverter(configConverter)),
        (snapshot) => {
          setConfig(snapshot.exists() ? snapshot.data() : null)
          setLoading(false)
        },
        () => setLoading(false),
      ),
    [],
  )

  return { config, loading }
}
