import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const LAST_VIEWED_KEY = 'snapspare-last-viewed-part'

const logPartCoViewCallable = httpsCallable<{ partId: string; previousPartId?: string }, { ok: boolean }>(
  functions,
  'logPartCoView',
)

/**
 * Fire-and-forget "others also viewed" signal: reads/writes a
 * session-scoped last-viewed part id, so viewing two PDPs back to back in
 * the same tab session counts as a co-view pair server-side (see
 * functions/src/recommendation/logPartCoView.ts). Never awaited by
 * callers — a failed or slow call here must never block or affect the
 * page itself.
 */
export function logPartCoView(partId: string): void {
  const previousPartId = sessionStorage.getItem(LAST_VIEWED_KEY) ?? undefined
  sessionStorage.setItem(LAST_VIEWED_KEY, partId)
  if (previousPartId === partId) return
  void logPartCoViewCallable({ partId, previousPartId }).catch(() => {})
}
