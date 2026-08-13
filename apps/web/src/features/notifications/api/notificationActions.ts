import type {
  MarkNotificationReadRequest,
  RegisterFcmTokenRequest,
  UnregisterFcmTokenRequest,
  UpdateNotificationPreferencesRequest,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const markNotificationReadCallable = httpsCallable<MarkNotificationReadRequest, { success: true }>(
  functions,
  'markNotificationRead',
)
const markAllNotificationsReadCallable = httpsCallable<Record<string, never>, { updated: number }>(
  functions,
  'markAllNotificationsRead',
)
const updateNotificationPreferencesCallable = httpsCallable<UpdateNotificationPreferencesRequest, { success: true }>(
  functions,
  'updateNotificationPreferences',
)
const registerFcmTokenCallable = httpsCallable<RegisterFcmTokenRequest, { success: true }>(
  functions,
  'registerFcmToken',
)
const unregisterFcmTokenCallable = httpsCallable<UnregisterFcmTokenRequest, { success: true }>(
  functions,
  'unregisterFcmToken',
)

export async function markNotificationRead(notificationId: string): Promise<void> {
  await markNotificationReadCallable({ notificationId })
}

export async function markAllNotificationsRead(): Promise<void> {
  await markAllNotificationsReadCallable({})
}

export async function updateNotificationPreferences(input: UpdateNotificationPreferencesRequest): Promise<void> {
  await updateNotificationPreferencesCallable(input)
}

export async function registerFcmToken(token: string): Promise<void> {
  await registerFcmTokenCallable({ token })
}

export async function unregisterFcmToken(token: string): Promise<void> {
  await unregisterFcmTokenCallable({ token })
}
