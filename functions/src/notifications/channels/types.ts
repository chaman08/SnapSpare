/** Common result shape every channel adapter returns, so processNotificationChannels.ts can handle them uniformly. */
export type ChannelSendResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; error: string; invalidToken?: boolean }

export interface ChannelSendArgs {
  userId: string
  language: 'en' | 'hi'
  vars: Record<string, string>
}
