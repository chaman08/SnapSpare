import { deleteField, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ProfilePatch {
  displayName: string
  email?: string
  preferredLanguage: 'en' | 'hi'
  buyerType: 'retail' | 'mechanic' | 'garage' | 'fleet' | 'reseller'
  gstin?: string
}

/**
 * Fields a buyer may edit themselves — role/roles/status are never
 * client-writable (enforced by security rules too). Clearing an optional
 * field deletes it rather than writing null, since the shared zod schema
 * models it as `.optional()` (absent), not `.nullable()`.
 */
export async function updateBuyerProfile(userId: string, patch: ProfilePatch): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    displayName: patch.displayName,
    email: patch.email ? patch.email : deleteField(),
    preferredLanguage: patch.preferredLanguage,
    buyerType: patch.buyerType,
    gstin: patch.gstin ? patch.gstin : deleteField(),
    updatedAt: Date.now(),
  })
}

/** Standalone setter for the PDP's inline GST display toggle — a lighter-weight write than the full profile form for a single, frequently-flipped preference. */
export async function updateGstDisplayMode(userId: string, mode: 'inclusive' | 'exclusive'): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    gstDisplayMode: mode,
    updatedAt: Date.now(),
  })
}

/** Standalone setter used by the header/onboarding LanguageSwitcher — same lighter-weight pattern as updateGstDisplayMode, so switching languages doesn't require the full profile form to be open. */
export async function updateLanguagePreference(userId: string, preferredLanguage: 'en' | 'hi'): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    preferredLanguage,
    updatedAt: Date.now(),
  })
}
