import { z } from 'zod'
import { buyerTypeSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import { userIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const campaignIdSchema = z.string().min(1)
export type CampaignId = z.infer<typeof campaignIdSchema>

/**
 * Marketing module (design brief item 9) push campaign composer. Audience
 * segments are a `buyerType` filter (or 'all') — the only buyer-attribute
 * this codebase indexes cheaply; a richer segment builder (RFM, geography,
 * category affinity) isn't modeled anywhere yet. WhatsApp delivery is
 * deliberately not offered: this platform's WhatsApp Cloud API integration
 * requires a pre-approved Meta message template per notification type (see
 * channels/whatsappAdapter.ts's WhatsappTemplate doc comment) — incompatible
 * with free-text admin-authored campaign content, not a design choice made
 * here.
 */
export const campaignAudienceSchema = z.object({
  buyerType: z.union([buyerTypeSchema, z.literal('all')]),
})
export type CampaignAudience = z.infer<typeof campaignAudienceSchema>

export const campaignSchema = z.object({
  id: campaignIdSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  audience: campaignAudienceSchema,
  status: z.enum(['draft', 'sent']),
  recipientCount: z.number().int().nonnegative().optional(),
  createdBy: userIdSchema,
  sentAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Campaign = z.infer<typeof campaignSchema>

export const campaignConverter = makeFirestoreConverter(campaignSchema)

export const saveCampaignRequestSchema = z.object({
  id: campaignIdSchema.optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  audience: campaignAudienceSchema,
})
export type SaveCampaignRequest = z.infer<typeof saveCampaignRequestSchema>

export const saveCampaignResultSchema = z.object({ id: campaignIdSchema })
export type SaveCampaignResult = z.infer<typeof saveCampaignResultSchema>

export const sendCampaignRequestSchema = z.object({ id: campaignIdSchema })
export type SendCampaignRequest = z.infer<typeof sendCampaignRequestSchema>

export const sendCampaignResultSchema = z.object({ recipientCount: z.number().int().nonnegative() })
export type SendCampaignResult = z.infer<typeof sendCampaignResultSchema>
