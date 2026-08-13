import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import type { CallableRequest } from 'firebase-functions/v2/https'
import { extractIp } from './requestContext.js'

export interface RateLimitRule {
  /** Unique key for the calling callable, namespaces its `rateLimits` doc ids so unrelated callables never collide. */
  name: string
  /** Max calls allowed per signed-in uid within the window. */
  perUidLimit: number
  /** Max calls allowed per client IP within the window (covers pre-auth abuse and multi-account abuse from one source). */
  perIpLimit: number
  /** Fixed window size in minutes counters reset on — e.g. 60 for "per hour", 1440 for "per day". */
  windowMinutes: number
}

function bucketKey(windowMinutes: number, now: number): string {
  return String(Math.floor(now / (windowMinutes * 60_000)))
}

async function checkAndIncrement(docId: string, limit: number, now: number): Promise<void> {
  const db = getFirestore()
  const ref = db.collection('rateLimits').doc(docId)

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    const count = snapshot.exists ? ((snapshot.data()?.count as number | undefined) ?? 0) : 0

    if (count >= limit) {
      throw new HttpsError('resource-exhausted', 'Too many requests. Please try again shortly.')
    }

    tx.set(ref, { count: count + 1, updatedAt: now }, { merge: true })
  })
}

/**
 * Shared callable-abuse throttle: enforces both a per-uid and a per-IP cap
 * within a fixed window, backed by the same `rateLimits` collection
 * lookupVehicleByReg.ts already uses (closed to direct client read/write in
 * firestore.rules — only the Admin SDK ever touches it). Call this right
 * after input validation, before any Firestore write, on every callable a
 * buyer or seller can trigger repeatedly (order placement, RFQs, disputes,
 * reports, bank-detail submission, credit requests...) — see each call
 * site's own comment for why its specific limits were chosen. Per-uid and
 * per-IP are independent checks: either one tripping blocks the call, so a
 * single abusive IP can't route around its cap by rotating accounts, and a
 * single compromised/scripted account can't route around its cap via a
 * rotating-IP botnet without also being capped by uid.
 */
export async function enforceRateLimit(request: CallableRequest, rule: RateLimitRule): Promise<void> {
  const now = Date.now()
  const bucket = bucketKey(rule.windowMinutes, now)
  const uid = request.auth?.uid
  const ip = extractIp(request)

  if (uid) {
    await checkAndIncrement(`${rule.name}_uid_${uid}_${bucket}`, rule.perUidLimit, now)
  }
  if (ip) {
    await checkAndIncrement(`${rule.name}_ip_${ip.replace(/[/\s]/g, '_')}_${bucket}`, rule.perIpLimit, now)
  }
}
