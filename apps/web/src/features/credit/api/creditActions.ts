import type {
  ApproveCreditLimitRequest,
  ApproveCreditLimitResult,
  CreateCreditRepaymentLinkRequest,
  CreateCreditRepaymentLinkResult,
  RequestCreditLimitRequest,
  RequestCreditLimitResult,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const requestCreditLimitCallable = httpsCallable<RequestCreditLimitRequest, RequestCreditLimitResult>(
  functions,
  'requestCreditLimit',
)
const approveCreditLimitCallable = httpsCallable<ApproveCreditLimitRequest, ApproveCreditLimitResult>(
  functions,
  'approveCreditLimit',
)
const createCreditRepaymentLinkCallable = httpsCallable<CreateCreditRepaymentLinkRequest, CreateCreditRepaymentLinkResult>(
  functions,
  'createCreditRepaymentLink',
)

export const requestCreditLimit = (request: RequestCreditLimitRequest) =>
  requestCreditLimitCallable(request).then((r) => r.data)

export const approveCreditLimit = (request: ApproveCreditLimitRequest) =>
  approveCreditLimitCallable(request).then((r) => r.data)

export const createCreditRepaymentLink = (request: CreateCreditRepaymentLinkRequest) =>
  createCreditRepaymentLinkCallable(request).then((r) => r.data)
