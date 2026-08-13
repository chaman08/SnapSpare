import type {
  BulkAcceptSubOrdersRequest,
  BulkAcceptSubOrdersResult,
  CancelSubOrderRequest,
  RefundReturnRequest,
  RefundReturnResult,
  RequestReturnRequest,
  RequestReturnResult,
  ShipSubOrderRequest,
  SubOrderActionResult,
  SubOrderIdRequest,
  UpdateShipmentStatusRequest,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const acceptSubOrderCallable = httpsCallable<SubOrderIdRequest, SubOrderActionResult>(functions, 'acceptSubOrder')
const rejectSubOrderCallable = httpsCallable<SubOrderIdRequest, SubOrderActionResult>(functions, 'rejectSubOrder')
const packSubOrderCallable = httpsCallable<SubOrderIdRequest, SubOrderActionResult>(functions, 'packSubOrder')
const shipSubOrderCallable = httpsCallable<ShipSubOrderRequest, SubOrderActionResult>(functions, 'shipSubOrder')
const updateShipmentStatusCallable = httpsCallable<UpdateShipmentStatusRequest, SubOrderActionResult>(
  functions,
  'updateShipmentStatus',
)
const cancelSubOrderCallable = httpsCallable<CancelSubOrderRequest, SubOrderActionResult>(functions, 'cancelSubOrder')
const bulkAcceptSubOrdersCallable = httpsCallable<BulkAcceptSubOrdersRequest, BulkAcceptSubOrdersResult>(
  functions,
  'bulkAcceptSubOrders',
)
const requestReturnCallable = httpsCallable<RequestReturnRequest, RequestReturnResult>(functions, 'requestReturn')
const refundReturnCallable = httpsCallable<RefundReturnRequest, RefundReturnResult>(functions, 'refundReturn')
const getReturnEvidenceUrlsCallable = httpsCallable<
  { returnId: string },
  { evidenceUrls: string[]; videoUrl?: string; qcPhotoUrls: string[] }
>(functions, 'getReturnEvidenceUrls')

export const acceptSubOrder = (subOrderId: string) => acceptSubOrderCallable({ subOrderId }).then((r) => r.data)
export const rejectSubOrder = (subOrderId: string) => rejectSubOrderCallable({ subOrderId }).then((r) => r.data)
export const packSubOrder = (subOrderId: string) => packSubOrderCallable({ subOrderId }).then((r) => r.data)
export const shipSubOrder = (request: ShipSubOrderRequest) => shipSubOrderCallable(request).then((r) => r.data)
export const updateShipmentStatus = (request: UpdateShipmentStatusRequest) =>
  updateShipmentStatusCallable(request).then((r) => r.data)
export const cancelSubOrder = (request: CancelSubOrderRequest) => cancelSubOrderCallable(request).then((r) => r.data)
export const bulkAcceptSubOrders = (subOrderIds: string[]) =>
  bulkAcceptSubOrdersCallable({ subOrderIds }).then((r) => r.data)
export const requestReturn = (request: RequestReturnRequest) => requestReturnCallable(request).then((r) => r.data)
export const refundReturn = (returnId: string) => refundReturnCallable({ returnId }).then((r) => r.data)
export const getReturnEvidenceUrls = (returnId: string) => getReturnEvidenceUrlsCallable({ returnId }).then((r) => r.data)

/** Maps a subOrder-transition/return failure to an i18n key under `orders.errors.*`. */
export function mapSubOrderActionErrorToI18nKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? ''
  switch (message) {
    case 'invalid_transition':
      return 'orders.errors.invalidTransition'
    case 'not_your_suborder':
    case 'not_a_participant':
    case 'not_your_return':
      return 'orders.errors.permissionDenied'
    case 'order_not_actionable':
      return 'orders.errors.orderNotActionable'
    case 'not_delivered':
      return 'orders.errors.notDelivered'
    case 'return_window_closed':
      return 'orders.errors.returnWindowClosed'
    case 'return_already_open':
      return 'orders.errors.returnAlreadyOpen'
    case 'qty_exceeds_line_item':
      return 'orders.errors.qtyExceedsLineItem'
    case 'evidence_required':
      return 'orders.errors.evidenceRequired'
    case 'category_not_returnable':
      return 'orders.errors.categoryNotReturnable'
    case 'return_not_requested':
    case 'return_not_approved':
      return 'orders.errors.invalidTransition'
    case 'seller_origin_not_set':
      return 'orders.errors.sellerOriginNotSet'
    case 'no_warranty':
      return 'orders.errors.noWarranty'
    case 'warranty_expired':
      return 'orders.errors.warrantyExpired'
    default:
      return 'orders.errors.generic'
  }
}
