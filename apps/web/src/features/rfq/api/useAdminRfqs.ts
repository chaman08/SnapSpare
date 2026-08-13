import type { Rfq } from '@snapspare/shared'
import { rfqConverter } from '@snapspare/shared'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

const ADMIN_RFQ_SCAN_LIMIT = 300

/**
 * Admin-only: the most recent RFQs, newest first — bounded rather than an
 * unbounded collection read. Requirement 7's "spot demand for parts the
 * catalogue is missing" is answered by grouping the `partId`-less ones by
 * `categorySlug` client-side (see groupDemandByCategorySlug below) rather
 * than a dedicated aggregation query — exact grouping only, no
 * fuzzy/semantic clustering across differently-worded free-text requests.
 */
export function useAdminRfqs() {
  const [rfqs, setRfqs] = useState<Rfq[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'rfqs').withConverter(clientConverter(rfqConverter)),
      orderBy('createdAt', 'desc'),
      limit(ADMIN_RFQ_SCAN_LIMIT),
    )
    return onSnapshot(q, (snapshot) => {
      setRfqs(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { rfqs, loading }
}

export interface DemandGroup {
  categorySlug: string
  count: number
  sampleDescriptions: string[]
}

/** Groups RFQs with no catalogue `partId` by `categorySlug`, sorted by count desc — the catalogue-gap signal for admins. */
export function groupDemandByCategorySlug(rfqs: Rfq[]): DemandGroup[] {
  const groups = new Map<string, DemandGroup>()
  for (const rfq of rfqs) {
    if (rfq.partId) continue
    const categorySlug = rfq.categorySlug ?? 'uncategorized'
    const existing = groups.get(categorySlug)
    if (existing) {
      existing.count += 1
      if (rfq.freeTextDescription && existing.sampleDescriptions.length < 5) {
        existing.sampleDescriptions.push(rfq.freeTextDescription)
      }
    } else {
      groups.set(categorySlug, {
        categorySlug,
        count: 1,
        sampleDescriptions: rfq.freeTextDescription ? [rfq.freeTextDescription] : [],
      })
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count)
}
