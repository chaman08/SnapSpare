import {
  type Notification,
  type NotificationChannel,
  type NotificationDelivery,
  type NotificationStatus,
  notificationSchema,
} from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { sendEmail } from './channels/emailAdapter.js'
import { sendSms } from './channels/msg91Adapter.js'
import { sendPush } from './channels/pushAdapter.js'
import type { ChannelSendResult } from './channels/types.js'
import { sendWhatsapp } from './channels/whatsappAdapter.js'
import { checkAndIncrementRateLimit } from './rateLimit.js'
import { isMarketingType, isQuietHoursIST, nextQuietHoursEndIST, resolveNotificationPreferences } from './preferences.js'
import { MSG91_API_KEY, RESEND_API_KEY, WHATSAPP_ACCESS_TOKEN } from './secrets.js'
import { getTemplate, type TemplateVars } from './templates/index.js'
import { stripUndefined } from '../util/stripUndefined.js'

const MAX_ATTEMPTS = 5
/** 1m, 5m, 30m, 2h, 6h — index matches the attempt number that just failed. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000]

/** stripUndefined() returns Partial<T> (it can't statically prove required fields survive) — safe to cast back here since `status`/`attempts` are always passed as literals at every call site below. */
function cleanDelivery(delivery: NotificationDelivery): NotificationDelivery {
  return stripUndefined(delivery) as NotificationDelivery
}

/** Builds the per-channel send, given an already-resolved template (undefined means "no template for this type/channel"). */
async function dispatchChannel(
  channel: NotificationChannel,
  userId: string,
  language: 'en' | 'hi',
  vars: TemplateVars,
  notificationType: Notification['type'],
): Promise<ChannelSendResult | undefined> {
  if (channel === 'push') {
    const template = getTemplate(notificationType, 'push', language, vars)
    if (!template) return undefined
    return sendPush({ userId, language, vars }, template)
  }
  if (channel === 'sms') {
    const template = getTemplate(notificationType, 'sms', language, vars)
    if (!template) return undefined
    return sendSms(
      { userId, language, vars },
      template,
      { apiKey: MSG91_API_KEY.value(), senderId: process.env.MSG91_SENDER_ID ?? 'SNPSPR', route: process.env.MSG91_ROUTE ?? '4' },
    )
  }
  if (channel === 'whatsapp') {
    const template = getTemplate(notificationType, 'whatsapp', language, vars)
    if (!template) return undefined
    return sendWhatsapp(
      { userId, language, vars },
      template,
      { accessToken: WHATSAPP_ACCESS_TOKEN.value(), phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '' },
    )
  }
  const template = getTemplate(notificationType, 'email', language, vars)
  if (!template) return undefined
  return sendEmail(
    { userId, language, vars },
    template,
    { apiKey: RESEND_API_KEY.value(), fromAddress: process.env.RESEND_FROM_EMAIL ?? 'notifications@snapspare.in' },
  )
}

function rollupStatus(deliveries: Record<string, NotificationDelivery>): NotificationStatus {
  const values = Object.values(deliveries)
  if (values.some((d) => d.status === 'sent' || d.status === 'delivered')) return 'sent'
  if (values.some((d) => d.status === 'pending')) return 'failed'
  if (values.some((d) => d.status === 'dead_letter')) return 'dead_letter'
  return 'sent' // every channel resolved to 'skipped' — nothing to deliver, treat as done
}

function rollupNextRetryAt(deliveries: Record<string, NotificationDelivery>): number | undefined {
  const pending = Object.values(deliveries)
    .filter((d): d is NotificationDelivery & { nextRetryAt: number } => d.status === 'pending' && d.nextRetryAt !== undefined)
    .map((d) => d.nextRetryAt)
  return pending.length > 0 ? Math.min(...pending) : undefined
}

/**
 * Core dispatch loop shared by dispatchNotification.ts (fresh doc trigger)
 * and retryFailedNotifications.ts (scheduled retry sweep) — given a
 * notificationsQueue doc id, attempts every channel listed on it that
 * isn't already resolved (sent/dead_letter/skipped) or isn't yet due for
 * retry, applying preference/quiet-hours/rate-limit gating for marketing
 * types first (transactional types always send, per the Phase 16 hard
 * rule). Writes delivery results back and rolls up the doc's top-level
 * status/nextRetryAt.
 */
export async function processNotificationChannels(notificationId: string): Promise<void> {
  const db = getFirestore()
  const ref = db.collection('notificationsQueue').doc(notificationId)
  const snapshot = await ref.get()
  if (!snapshot.exists) return

  const parsed = notificationSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
  if (!parsed.success) {
    logger.error('processNotificationChannels: notification doc failed schema validation', {
      notificationId,
      issues: parsed.error.issues,
    })
    return
  }
  const notification = parsed.data

  if (notification.channels.length === 0) {
    if (notification.status === 'queued') await ref.update({ status: 'sent', sentAt: notification.sentAt ?? Date.now() })
    return
  }

  await ref.update({ status: 'processing' })

  const now = Date.now()
  const marketing = isMarketingType(notification.type)
  const prefs = marketing ? await resolveNotificationPreferences(db, notification.userId) : undefined

  const vars: TemplateVars = {
    ...notification.data,
    orderId: notification.orderId ?? '',
    subOrderId: notification.subOrderId ?? '',
    returnId: notification.returnId ?? '',
    rfqId: notification.rfqId ?? '',
  }

  const deliveries: Record<string, NotificationDelivery> = { ...notification.deliveries }

  for (const channel of new Set(notification.channels)) {
    const existing = deliveries[channel]
    if (existing && existing.status !== 'pending' && existing.status !== 'failed') continue
    if (existing?.status === 'pending' && existing.nextRetryAt && existing.nextRetryAt > now) continue

    const attempts = existing?.attempts ?? 0

    if (marketing && prefs) {
      if (prefs.marketingOptOut || !prefs.channels[channel]) {
        deliveries[channel] = cleanDelivery({ status: 'skipped', attempts, skippedReason: 'opted_out' })
        continue
      }
      if (isQuietHoursIST(now)) {
        deliveries[channel] = cleanDelivery({
          status: 'pending',
          attempts,
          nextRetryAt: nextQuietHoursEndIST(now),
        })
        continue
      }
      const allowed = await checkAndIncrementRateLimit(db, notification.userId, channel)
      if (!allowed) {
        deliveries[channel] = cleanDelivery({ status: 'skipped', attempts, skippedReason: 'rate_limited' })
        continue
      }
    }

    let result: ChannelSendResult | undefined
    try {
      result = await dispatchChannel(channel, notification.userId, notification.language, vars, notification.type)
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : String(error) }
    }

    if (!result) {
      deliveries[channel] = cleanDelivery({ status: 'skipped', attempts, skippedReason: 'no_template_for_channel' })
      continue
    }

    const nextAttempts = attempts + 1

    if (result.ok) {
      deliveries[channel] = cleanDelivery({
        status: 'sent',
        attempts: nextAttempts,
        lastAttemptAt: now,
        providerMessageId: result.providerMessageId,
      })
      continue
    }

    if (nextAttempts >= MAX_ATTEMPTS) {
      deliveries[channel] = cleanDelivery({
        status: 'dead_letter',
        attempts: nextAttempts,
        lastAttemptAt: now,
        lastError: result.error,
      })
      await db.collection('notificationsDeadLetter').doc().set({
        notificationId,
        userId: notification.userId,
        channel,
        type: notification.type,
        attempts: nextAttempts,
        lastError: result.error,
        failedAt: now,
        resolved: false,
      })
      continue
    }

    const backoff = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[BACKOFF_MS.length - 1]
    deliveries[channel] = cleanDelivery({
      status: 'pending',
      attempts: nextAttempts,
      lastAttemptAt: now,
      lastError: result.error,
      nextRetryAt: now + (backoff ?? 60_000),
    })
  }

  const status = rollupStatus(deliveries)
  const nextRetryAt = rollupNextRetryAt(deliveries)

  await ref.update({
    deliveries,
    status,
    ...(status === 'sent' ? { sentAt: notification.sentAt ?? now } : {}),
    nextRetryAt: nextRetryAt ?? FieldValue.delete(),
  })
}
