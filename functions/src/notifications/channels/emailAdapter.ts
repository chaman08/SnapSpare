import { userSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import type { ChannelSendArgs, ChannelSendResult } from './types.js'

export interface EmailTemplate {
  subject: string
  html: string
}

export async function sendEmail(
  args: ChannelSendArgs,
  template: EmailTemplate,
  env: { apiKey: string; fromAddress: string },
): Promise<ChannelSendResult> {
  const db = getFirestore()
  const snapshot = await db.collection('users').doc(args.userId).get()
  if (!snapshot.exists) return { ok: false, error: 'user_not_found' }

  const parsed = userSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
  if (!parsed.success || !parsed.data.email) return { ok: false, error: 'no_email_on_file' }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.apiKey}` },
    body: JSON.stringify({
      from: env.fromAddress,
      to: parsed.data.email,
      subject: template.subject,
      html: template.html,
    }),
  })

  const body = (await response.json().catch(() => undefined)) as { id?: string; message?: string } | undefined

  if (!response.ok) {
    return { ok: false, error: body?.message ?? `resend_api_${response.status}` }
  }
  return { ok: true, providerMessageId: body?.id }
}
