import { userSchema } from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import type { ChannelSendArgs, ChannelSendResult } from './types.js'

const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

export interface PushTemplate {
  title: string
  body: string
  /** Deep link opened by the service worker's notificationclick handler — e.g. `/orders/{orderId}`. */
  link?: string
}

/**
 * Fans out to every FCM token registered on the user's profile
 * (`users/{userId}.fcmTokens`, see registerFcmToken.ts). Prunes any token
 * the FCM API reports as no-longer-valid so the list doesn't grow stale.
 * Reports `ok: false` only when every token failed (or there were none) —
 * a partial success across multiple devices still counts as delivered.
 */
export async function sendPush(args: ChannelSendArgs, template: PushTemplate): Promise<ChannelSendResult> {
  const db = getFirestore()
  const snapshot = await db.collection('users').doc(args.userId).get()
  if (!snapshot.exists) return { ok: false, error: 'user_not_found' }

  const parsed = userSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
  const tokens = parsed.success ? parsed.data.fcmTokens : []
  if (tokens.length === 0) return { ok: false, error: 'no_registered_tokens' }

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: template.title, body: template.body },
    data: template.link ? { link: template.link } : undefined,
    webpush: template.link ? { fcmOptions: { link: template.link } } : undefined,
  })

  const invalidTokens: string[] = []
  let firstMessageId: string | undefined
  let firstError: string | undefined
  response.responses.forEach((result, index) => {
    if (result.success) {
      firstMessageId ??= result.messageId
      return
    }
    const code = result.error?.code
    firstError ??= result.error?.message ?? code
    if (code && INVALID_TOKEN_ERROR_CODES.has(code)) {
      const token = tokens[index]
      if (token) invalidTokens.push(token)
    }
  })

  if (invalidTokens.length > 0) {
    await db
      .collection('users')
      .doc(args.userId)
      .update({ fcmTokens: FieldValue.arrayRemove(...invalidTokens), updatedAt: Date.now() })
  }

  if (response.successCount > 0) return { ok: true, providerMessageId: firstMessageId }
  return { ok: false, error: firstError ?? 'push_send_failed' }
}
