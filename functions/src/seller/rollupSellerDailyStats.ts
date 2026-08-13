import { type SellerDailyTopPart, returnSchema, sellerSlaPreferencesSchema, subOrderSchema } from '@snapspare/shared'
import type { Firestore } from 'firebase-admin/firestore'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'

const DAY_MS = 24 * 60 * 60_000
const BATCH_LIMIT = 400
const DEFAULT_SLA_PREFERENCES = { acceptWithinHours: 24, packWithinHours: 24 }

interface DayBucket {
  ordersCount: number
  revenuePaise: number
  unitsSold: number
  cancelledCount: number
  topParts: Map<string, SellerDailyTopPart>
}

interface SlaBucket {
  slaAcceptedOnTime: number
  slaAcceptedLate: number
  slaPackedOnTime: number
  slaPackedLate: number
}

function emptyDayBucket(): DayBucket {
  return { ordersCount: 0, revenuePaise: 0, unitsSold: 0, cancelledCount: 0, topParts: new Map() }
}

function emptySlaBucket(): SlaBucket {
  return { slaAcceptedOnTime: 0, slaAcceptedLate: 0, slaPackedOnTime: 0, slaPackedLate: 0 }
}

function dateBucketFor(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Yesterday's full UTC day — this runs once daily just after midnight UTC, so "yesterday" is the last complete day available to roll up. */
function yesterdayUtcWindow(now: number): { date: string; startMs: number; endMs: number } {
  const endMs = Math.floor(now / DAY_MS) * DAY_MS
  const startMs = endMs - DAY_MS
  return { date: dateBucketFor(startMs), startMs, endMs }
}

async function getSlaPreferences(
  db: Firestore,
  cache: Map<string, { acceptWithinHours: number; packWithinHours: number }>,
  sellerId: string,
): Promise<{ acceptWithinHours: number; packWithinHours: number }> {
  const cached = cache.get(sellerId)
  if (cached) return cached

  const snapshot = await db.collection('sellers').doc(sellerId).collection('settings').doc('general').get()
  const parsed = sellerSlaPreferencesSchema.safeParse(snapshot.data()?.slaPreferences)
  const prefs = parsed.success ? parsed.data : DEFAULT_SLA_PREFERENCES
  cache.set(sellerId, prefs)
  return prefs
}

/**
 * Daily per-seller aggregate (requirement 6) — a client-side scan of raw
 * `subOrders` for a 7/30/90-day revenue chart doesn't scale, so this writes
 * one `sellerDailyStats/{sellerId}_{date}` doc per seller per day. Two
 * independent passes over `subOrders`: one bucketed by `createdAt` (orders
 * placed that day — revenue/units/top-parts), one by `updatedAt` (a proxy
 * for "had a status transition that day" — SLA scoring), since an order
 * placed on one day can be accepted/packed on a later one. Deterministic
 * doc ids make a retried run idempotent (last-write-wins on the same
 * numbers, not a double-count).
 */
export const rollupSellerDailyStats = onSchedule(
  { region: 'asia-south1', schedule: 'every day 01:00', timeZone: 'Etc/UTC', timeoutSeconds: 300, memory: '512MiB' },
  async () => {
    const db = getFirestore()
    const { date, startMs, endMs } = yesterdayUtcWindow(Date.now())

    const dayBuckets = new Map<string, DayBucket>()
    const createdSnapshot = await db.collection('subOrders').where('createdAt', '>=', startMs).where('createdAt', '<', endMs).get()
    for (const doc of createdSnapshot.docs) {
      const parsed = subOrderSchema.safeParse({ id: doc.id, ...doc.data() })
      if (!parsed.success) continue
      const sub = parsed.data

      const bucket = dayBuckets.get(sub.sellerId) ?? emptyDayBucket()
      bucket.ordersCount += 1
      if (sub.status === 'cancelled' || sub.status === 'rejected') bucket.cancelledCount += 1

      if (sub.status !== 'cancelled' && sub.status !== 'rejected') {
        bucket.revenuePaise += sub.totalPaise
        for (const item of sub.items) {
          bucket.unitsSold += item.qty
          const existing = bucket.topParts.get(item.partId)
          if (existing) {
            existing.qty += item.qty
            existing.revenuePaise += item.lineTotalPaise
          } else {
            bucket.topParts.set(item.partId, {
              partId: item.partId,
              listingId: item.listingId,
              title: item.title,
              qty: item.qty,
              revenuePaise: item.lineTotalPaise,
            })
          }
        }
      }
      dayBuckets.set(sub.sellerId, bucket)
    }

    const slaBuckets = new Map<string, SlaBucket>()
    const slaPrefsCache = new Map<string, { acceptWithinHours: number; packWithinHours: number }>()
    const updatedSnapshot = await db.collection('subOrders').where('updatedAt', '>=', startMs).where('updatedAt', '<', endMs).get()
    for (const doc of updatedSnapshot.docs) {
      const parsed = subOrderSchema.safeParse({ id: doc.id, ...doc.data() })
      if (!parsed.success) continue
      const sub = parsed.data

      const acceptedEntry = sub.timeline.find((t) => t.status === 'accepted' && t.at >= startMs && t.at < endMs)
      const packedEntry = sub.timeline.find((t) => t.status === 'packed' && t.at >= startMs && t.at < endMs)
      if (!acceptedEntry && !packedEntry) continue

      const bucket = slaBuckets.get(sub.sellerId) ?? emptySlaBucket()

      if (acceptedEntry) {
        const onTime = sub.slaAcceptByAt === undefined || acceptedEntry.at <= sub.slaAcceptByAt
        if (onTime) bucket.slaAcceptedOnTime += 1
        else bucket.slaAcceptedLate += 1
      }

      if (packedEntry) {
        const prefs = await getSlaPreferences(db, slaPrefsCache, sub.sellerId)
        const acceptedAt = sub.timeline.find((t) => t.status === 'accepted')?.at
        const deadline = acceptedAt !== undefined ? acceptedAt + prefs.packWithinHours * 60 * 60_000 : undefined
        const onTime = deadline === undefined || packedEntry.at <= deadline
        if (onTime) bucket.slaPackedOnTime += 1
        else bucket.slaPackedLate += 1
      }

      slaBuckets.set(sub.sellerId, bucket)
    }

    const returnsBuckets = new Map<string, number>()
    const returnsSnapshot = await db.collection('returns').where('requestedAt', '>=', startMs).where('requestedAt', '<', endMs).get()
    for (const doc of returnsSnapshot.docs) {
      const parsed = returnSchema.safeParse({ id: doc.id, ...doc.data() })
      if (!parsed.success) continue
      returnsBuckets.set(parsed.data.sellerId, (returnsBuckets.get(parsed.data.sellerId) ?? 0) + 1)
    }

    const sellerIds = new Set([...dayBuckets.keys(), ...slaBuckets.keys(), ...returnsBuckets.keys()])
    const now = Date.now()
    const sellerIdList = Array.from(sellerIds)

    for (let i = 0; i < sellerIdList.length; i += BATCH_LIMIT) {
      const chunk = sellerIdList.slice(i, i + BATCH_LIMIT)
      const batch = db.batch()
      for (const sellerId of chunk) {
        const day = dayBuckets.get(sellerId) ?? emptyDayBucket()
        const sla = slaBuckets.get(sellerId) ?? emptySlaBucket()
        const ref = db.collection('sellerDailyStats').doc(`${sellerId}_${date}`)
        batch.set(ref, {
          sellerId,
          date,
          ordersCount: day.ordersCount,
          revenuePaise: day.revenuePaise,
          unitsSold: day.unitsSold,
          topParts: Array.from(day.topParts.values())
            .sort((a, b) => b.revenuePaise - a.revenuePaise)
            .slice(0, 10),
          slaAcceptedOnTime: sla.slaAcceptedOnTime,
          slaAcceptedLate: sla.slaAcceptedLate,
          slaPackedOnTime: sla.slaPackedOnTime,
          slaPackedLate: sla.slaPackedLate,
          cancelledCount: day.cancelledCount,
          returnsCount: returnsBuckets.get(sellerId) ?? 0,
          createdAt: now,
          updatedAt: now,
        })
      }
      await batch.commit()
    }

    logger.info('rollupSellerDailyStats: rolled up', { date, sellersRolledUp: sellerIdList.length })
  },
)
