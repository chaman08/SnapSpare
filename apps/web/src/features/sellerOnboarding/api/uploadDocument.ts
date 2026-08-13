import { ref, uploadBytes } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { compressImageIfNeeded } from '@/features/sellerOnboarding/lib/compressImage'

export type SellerDocumentType = 'gst-certificate' | 'pan' | 'address-proof' | 'brand-auth' | 'shop-photo' | 'cancelled-cheque'

/**
 * Compresses (images only) then uploads to `sellers/{uid}/kyc/{docType}/...`
 * — writable by the applicant even before approval, since `sellerId == uid`
 * by design (see storage.rules' widened kyc write condition). Returns the
 * Storage path, not a download URL: these documents are admin-read-only,
 * never shown back to the applicant (matches the existing KYC path's
 * write-only convention).
 */
export async function uploadSellerDocument(uid: string, docType: SellerDocumentType, file: File): Promise<string> {
  const compressed = await compressImageIfNeeded(file)
  const path = `sellers/${uid}/kyc/${docType}/${Date.now()}-${compressed.name}`
  await uploadBytes(ref(storage, path), compressed)
  return path
}
