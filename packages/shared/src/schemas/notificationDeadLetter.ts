import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { notificationChannelSchema, notificationTypeSchema } from './notification'
import { notificationDeadLetterIdSchema, notificationIdSchema, userIdSchema } from '../ids'
import { epochMsSchema } from './common'

/**
 * One row per (notification, channel) that exhausted all delivery retries —
 * written by functions/src/notifications/processNotificationChannels.ts,
 * surfaced on an admin-only screen for manual triage. Admin-read only; see
 * firestore.rules. `resolved` is a triage flag an admin sets after
 * investigating — it never re-triggers a send (the retry sweep already owns
 * retries; this collection is a record of what gave up, not a retry queue).
 */
export const notificationDeadLetterSchema = z.object({
  id: notificationDeadLetterIdSchema,
  notificationId: notificationIdSchema,
  userId: userIdSchema,
  channel: notificationChannelSchema,
  type: notificationTypeSchema,
  attempts: z.number().int().nonnegative(),
  lastError: z.string(),
  failedAt: epochMsSchema,
  resolved: z.boolean().default(false),
})
export type NotificationDeadLetter = z.infer<typeof notificationDeadLetterSchema>

export const notificationDeadLetterConverter = makeFirestoreConverter(notificationDeadLetterSchema)
