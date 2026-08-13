import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { epochMsSchema } from './common'

/**
 * Content module (design brief item 10) — admin-editable overrides for
 * i18next string keys. `id` is the dotted i18next key itself (e.g.
 * `checkout.codDisabledNotice`), so a lookup is a direct doc read, not a
 * query. This collection is the admin-authoring surface only in this
 * phase — wiring an i18next backend/postProcessor to actually prefer these
 * over the bundled locale JSON at render time is a separate follow-up (see
 * the Content module's left-out note); today it's a durable, audited store
 * an ops/localization workflow can already write and read.
 */
export const stringOverrideSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  en: z.string(),
  hi: z.string(),
  updatedAt: epochMsSchema,
})
export type StringOverride = z.infer<typeof stringOverrideSchema>

export const stringOverrideConverter = makeFirestoreConverter(stringOverrideSchema)

export const setStringOverrideRequestSchema = z.object({
  key: z.string().min(1),
  en: z.string(),
  hi: z.string(),
})
export type SetStringOverrideRequest = z.infer<typeof setStringOverrideRequestSchema>

export const setStringOverrideResultSchema = z.object({ key: z.string() })
export type SetStringOverrideResult = z.infer<typeof setStringOverrideResultSchema>
