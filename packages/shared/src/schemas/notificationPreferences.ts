import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { userIdSchema } from '../ids'
import { epochMsSchema } from './common'

/**
 * Canonical per-user channel preferences for Phase 16's dispatcher — one doc
 * per user, works for buyers, sellers, and admins alike (doc id == userId).
 * Supersedes (does not migrate) the older, seller-only
 * `sellerSettings.notificationPreferences` embedded field: that field still
 * powers its existing settings-form UI, but the dispatcher reads only this
 * collection going forward.
 *
 * Hard rule (see functions/src/notifications/preferences.ts): transactional
 * notification types always send regardless of these preferences or quiet
 * hours; only the small set of marketing types respect `marketingOptOut`
 * and IST quiet hours (21:00-09:00).
 */
export const notificationPreferencesSchema = z.object({
  /** Equal to `userId` by design — doc id under `notificationPreferences/{userId}`. */
  id: userIdSchema,
  userId: userIdSchema,
  channels: z
    .object({
      push: z.boolean(),
      sms: z.boolean(),
      whatsapp: z.boolean(),
      email: z.boolean(),
    })
    .default({ push: true, sms: true, whatsapp: true, email: true }),
  marketingOptOut: z.boolean().default(false),
  updatedAt: epochMsSchema,
})
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>

export const notificationPreferencesConverter = makeFirestoreConverter(notificationPreferencesSchema)
