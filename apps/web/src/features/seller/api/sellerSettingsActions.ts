import type { SetHolidayModeRequest, SetHolidayModeResult, SetStoreSlugRequest, SetStoreSlugResult } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { doc, updateDoc } from 'firebase/firestore'
import { db, functions } from '@/lib/firebase'

export interface StorePageInput {
  storeName?: string
  storeDescription?: string
}

/** Direct rules-guarded write (hasSellerPermission(sellerId,'manage_listings')) — deliberately excludes holidayMode, which is callable-only (see setHolidayMode below and firestore.rules). */
export async function updateStorePage(sellerId: string, input: StorePageInput): Promise<void> {
  await updateDoc(doc(db, 'sellers', sellerId, 'settings', 'general'), {
    ...input,
    updatedAt: Date.now(),
  })
}

export async function updateSlaPreferences(
  sellerId: string,
  slaPreferences: { acceptWithinHours: number; packWithinHours: number },
): Promise<void> {
  await updateDoc(doc(db, 'sellers', sellerId, 'settings', 'general'), {
    slaPreferences,
    updatedAt: Date.now(),
  })
}

export async function updateNotificationPreferences(
  sellerId: string,
  channels: ('push' | 'sms' | 'whatsapp' | 'email')[],
): Promise<void> {
  await updateDoc(doc(db, 'sellers', sellerId, 'settings', 'general'), {
    notificationPreferences: { channels },
    updatedAt: Date.now(),
  })
}

const setHolidayModeCallable = httpsCallable<SetHolidayModeRequest, SetHolidayModeResult>(functions, 'setHolidayMode')

/** Bulk-pauses/resumes listings — must go through the callable, never a direct settings-doc write (see functions/src/seller/setHolidayMode.ts). */
export async function setHolidayMode(request: SetHolidayModeRequest): Promise<SetHolidayModeResult> {
  const result = await setHolidayModeCallable(request)
  return result.data
}

const setStoreSlugCallable = httpsCallable<SetStoreSlugRequest, SetStoreSlugResult>(functions, 'setStoreSlug')

/** Atomically claims the public store handle — must go through the callable, never a direct settings-doc write (see functions/src/seller/setStoreSlug.ts). */
export async function setStoreSlug(request: SetStoreSlugRequest): Promise<SetStoreSlugResult> {
  const result = await setStoreSlugCallable(request)
  return result.data
}
