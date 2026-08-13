import type { VerifyPartAuthenticityRequest, VerifyPartAuthenticityResult } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const verifyPartAuthenticityCallable = httpsCallable<VerifyPartAuthenticityRequest, VerifyPartAuthenticityResult>(
  functions,
  'verifyPartAuthenticity',
)

export const verifyPartAuthenticity = (request: VerifyPartAuthenticityRequest) =>
  verifyPartAuthenticityCallable(request).then((r) => r.data)
