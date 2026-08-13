import type {
  AcceptRfqQuoteRequest,
  AcceptRfqQuoteResult,
  CreateRfqRequest,
  CreateRfqResult,
  SendRfqMessageRequest,
  SendRfqMessageResult,
  SubmitRfqQuoteRequest,
  SubmitRfqQuoteResult,
  WithdrawRfqQuoteRequest,
  WithdrawRfqRequest,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const createRfqCallable = httpsCallable<CreateRfqRequest, CreateRfqResult>(functions, 'createRfq')
const withdrawRfqCallable = httpsCallable<WithdrawRfqRequest, { rfqId: string }>(functions, 'withdrawRfq')
const submitRfqQuoteCallable = httpsCallable<SubmitRfqQuoteRequest, SubmitRfqQuoteResult>(functions, 'submitRfqQuote')
const withdrawRfqQuoteCallable = httpsCallable<WithdrawRfqQuoteRequest, { quoteId: string }>(
  functions,
  'withdrawRfqQuote',
)
const acceptRfqQuoteCallable = httpsCallable<AcceptRfqQuoteRequest, AcceptRfqQuoteResult>(functions, 'acceptRfqQuote')
const sendRfqMessageCallable = httpsCallable<SendRfqMessageRequest, SendRfqMessageResult>(functions, 'sendRfqMessage')

export const createRfq = (request: CreateRfqRequest) => createRfqCallable(request).then((r) => r.data)
export const withdrawRfq = (rfqId: string) => withdrawRfqCallable({ rfqId }).then((r) => r.data)
export const submitRfqQuote = (request: SubmitRfqQuoteRequest) => submitRfqQuoteCallable(request).then((r) => r.data)
export const withdrawRfqQuote = (quoteId: string) => withdrawRfqQuoteCallable({ quoteId }).then((r) => r.data)
export const acceptRfqQuote = (request: AcceptRfqQuoteRequest) => acceptRfqQuoteCallable(request).then((r) => r.data)
export const sendRfqMessage = (request: SendRfqMessageRequest) => sendRfqMessageCallable(request).then((r) => r.data)

/** Maps an RFQ callable failure to an i18n key under `rfq.errors.*` — same pattern as mapCreateOrderErrorToI18nKey/mapSubOrderActionErrorToI18nKey. */
export function mapRfqErrorToI18nKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? ''
  switch (message) {
    case 'rfq_not_open':
    case 'rfq_not_acceptable':
    case 'rfq_not_withdrawable':
      return 'rfq.errors.rfqNotOpen'
    case 'response_window_closed':
      return 'rfq.errors.responseWindowClosed'
    case 'quote_already_pending':
      return 'rfq.errors.quoteAlreadyPending'
    case 'quote_not_pending':
    case 'quote_not_found':
      return 'rfq.errors.quoteNotAvailable'
    case 'quote_expired':
      return 'rfq.errors.quoteExpired'
    case 'hsn_and_gst_required_for_free_text_rfq':
      return 'rfq.errors.hsnGstRequired'
    case 'listing_not_owned':
      return 'rfq.errors.listingNotOwned'
    case 'listing_or_part_required':
      return 'rfq.errors.listingOrPartRequired'
    case 'not_your_rfq':
    case 'not_your_quote':
    case 'not_a_participant':
      return 'rfq.errors.permissionDenied'
    case 'cod_not_eligible':
      return 'rfq.errors.codNotEligible'
    case 'credit_not_eligible':
      return 'rfq.errors.creditNotEligible'
    case 'shipping_address_not_found':
      return 'rfq.errors.addressNotFound'
    case 'payment_gateway_unavailable':
      return 'rfq.errors.gatewayUnavailable'
    case 'contact_info_blocked':
      return 'rfq.errors.contactInfoBlocked'
    default:
      return 'rfq.errors.generic'
  }
}
