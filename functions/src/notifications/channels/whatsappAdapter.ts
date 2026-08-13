import { userSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import type { ChannelSendArgs, ChannelSendResult } from './types.js'

const GRAPH_API_VERSION = 'v20.0'

export interface WhatsappTemplate {
  /**
   * Name of the pre-approved WhatsApp message template in Meta Business
   * Manager — these are placeholders (e.g. `order_shipped_v1`) until the
   * real templates are submitted and approved for this WhatsApp Business
   * Account; sends will fail with an "unknown template" error until then.
   */
  templateName: string
  languageCode: 'en' | 'hi'
  /** Values substituted into the approved template's numbered body placeholders, in order. */
  params: string[]
}

/** Indian 10-digit mobile numbers are stored without a country code (see mobileSchema) — WhatsApp/MSG91 both need E.164. */
function toE164India(mobile: string): string {
  return `91${mobile}`
}

export async function sendWhatsapp(
  args: ChannelSendArgs,
  template: WhatsappTemplate,
  env: { accessToken: string; phoneNumberId: string },
): Promise<ChannelSendResult> {
  const db = getFirestore()
  const snapshot = await db.collection('users').doc(args.userId).get()
  if (!snapshot.exists) return { ok: false, error: 'user_not_found' }

  const parsed = userSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
  if (!parsed.success || !parsed.data.phone) return { ok: false, error: 'no_phone_on_file' }

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${env.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.accessToken}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toE164India(parsed.data.phone),
      type: 'template',
      template: {
        name: template.templateName,
        language: { code: template.languageCode },
        components: [
          {
            type: 'body',
            parameters: template.params.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    }),
  })

  const body = (await response.json().catch(() => undefined)) as
    | { messages?: { id: string }[]; error?: { message?: string } }
    | undefined

  if (!response.ok) {
    return { ok: false, error: body?.error?.message ?? `whatsapp_api_${response.status}` }
  }
  return { ok: true, providerMessageId: body?.messages?.[0]?.id }
}
