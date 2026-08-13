import type { ReturnsConfig } from '@snapspare/shared'
import { returnsConfigConverter } from '@snapspare/shared'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to the public config/returns singleton (see useAppConfig.ts's identical shape) — the product page's non-returnable-category banner and the buyer-facing fair-use policy both read from it. Publicly readable (see firestore.rules' `config/{configId}` wildcard). */
export function useReturnsConfig(): { config: ReturnsConfig | null; loading: boolean } {
  const [config, setConfig] = useState<ReturnsConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'config', 'returns').withConverter(clientConverter(returnsConfigConverter)),
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
