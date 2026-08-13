import type {
  BulkUploadJob,
  CommitBulkListingUploadRequest,
  CommitBulkListingUploadResult,
  ParseBulkListingUploadRequest,
  ParseBulkListingUploadResult,
} from '@snapspare/shared'
import { bulkUploadJobConverter } from '@snapspare/shared'
import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, functions, storage } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

const parseBulkListingUploadCallable = httpsCallable<ParseBulkListingUploadRequest, ParseBulkListingUploadResult>(
  functions,
  'parseBulkListingUpload',
)
const commitBulkListingUploadCallable = httpsCallable<CommitBulkListingUploadRequest, CommitBulkListingUploadResult>(
  functions,
  'commitBulkListingUpload',
)

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx']

/** Uploads a seller's bulk-upload sheet to the storage path parseBulkListingUpload.ts requires it live under, and returns that path for the callable. */
export async function uploadBulkUploadFile(sellerId: string, file: File): Promise<string> {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error('unsupported_file_type')
  }
  const path = `sellers/${sellerId}/bulkUploads/${Date.now()}-${file.name}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return path
}

export async function parseBulkListingUpload(request: ParseBulkListingUploadRequest): Promise<ParseBulkListingUploadResult> {
  const result = await parseBulkListingUploadCallable(request)
  return result.data
}

export async function commitBulkListingUpload(request: CommitBulkListingUploadRequest): Promise<CommitBulkListingUploadResult> {
  const result = await commitBulkListingUploadCallable(request)
  return result.data
}

/** One-shot fetch (not a live subscription — the wizard only needs the row-level preview right after parse/commit, which it already knows to re-fetch after). */
export async function getBulkUploadJob(jobId: string): Promise<BulkUploadJob | undefined> {
  const snapshot = await getDoc(doc(db, 'bulkUploadJobs', jobId).withConverter(clientConverter(bulkUploadJobConverter)))
  return snapshot.exists() ? snapshot.data() : undefined
}

export async function getBulkUploadErrorReportUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath))
}
