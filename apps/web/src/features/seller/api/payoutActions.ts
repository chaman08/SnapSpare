import type { GetPayoutStatementRequest, GetPayoutStatementResult } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const getPayoutStatementCallable = httpsCallable<GetPayoutStatementRequest, GetPayoutStatementResult>(
  functions,
  'getPayoutStatement',
)

export const getPayoutStatement = (request: GetPayoutStatementRequest) =>
  getPayoutStatementCallable(request).then((r) => r.data)
