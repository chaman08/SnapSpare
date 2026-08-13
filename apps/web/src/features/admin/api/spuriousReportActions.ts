import type { ResolveSpuriousReportRequest, SpuriousReport } from '@snapspare/shared'
import { spuriousReportConverter } from '@snapspare/shared'
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Admin-only: live-subscribes to spurious-part reports not yet resolved (design brief item 4's investigation workflow). */
export function usePendingSpuriousReports() {
  const [reports, setReports] = useState<SpuriousReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'spuriousReports').withConverter(clientConverter(spuriousReportConverter)),
      where('status', 'in', ['submitted', 'under_review', 'seller_responded']),
      orderBy('createdAt', 'asc'),
    )
    return onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { reports, loading }
}

export function useSpuriousReportDetail(reportId: string | undefined) {
  const [report, setReport] = useState<SpuriousReport | null | undefined>(undefined)

  useEffect(() => {
    if (!reportId) {
      setReport(null)
      return
    }
    setReport(undefined)
    return onSnapshot(
      doc(db, 'spuriousReports', reportId).withConverter(clientConverter(spuriousReportConverter)),
      (snapshot) => setReport(snapshot.exists() ? snapshot.data() : null),
    )
  }, [reportId])

  return { report, loading: report === undefined }
}

const resolveSpuriousReportCallable = httpsCallable<ResolveSpuriousReportRequest, { status: string }>(
  functions,
  'resolveSpuriousReport',
)

export const resolveSpuriousReport = (request: ResolveSpuriousReportRequest) =>
  resolveSpuriousReportCallable(request).then((r) => r.data)
