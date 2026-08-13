import type {
  BookShipmentRequest,
  BookShipmentResult,
  CancelShipmentRequest,
  GenerateShippingLabelRequest,
  GenerateShippingLabelResult,
  RequestNdrReattemptRequest,
  RequestNdrReattemptResult,
  SchedulePickupRequest,
  SchedulePickupResult,
  SubOrderActionResult,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const bookShipmentCallable = httpsCallable<BookShipmentRequest, BookShipmentResult>(functions, 'bookShipment')
const schedulePickupCallable = httpsCallable<SchedulePickupRequest, SchedulePickupResult>(functions, 'schedulePickup')
const generateShippingLabelCallable = httpsCallable<GenerateShippingLabelRequest, GenerateShippingLabelResult>(
  functions,
  'generateShippingLabel',
)
const cancelShipmentCallable = httpsCallable<CancelShipmentRequest, SubOrderActionResult>(functions, 'cancelShipment')
const requestNdrReattemptCallable = httpsCallable<RequestNdrReattemptRequest, RequestNdrReattemptResult>(
  functions,
  'requestNdrReattempt',
)

export const bookShipment = (subOrderId: string) => bookShipmentCallable({ subOrderId }).then((r) => r.data)
export const schedulePickup = (request: SchedulePickupRequest) => schedulePickupCallable(request).then((r) => r.data)
export const generateShippingLabel = (subOrderId: string) =>
  generateShippingLabelCallable({ subOrderId }).then((r) => r.data)
export const cancelShipment = (subOrderId: string) => cancelShipmentCallable({ subOrderId }).then((r) => r.data)
export const requestNdrReattempt = (request: RequestNdrReattemptRequest) =>
  requestNdrReattemptCallable(request).then((r) => r.data)

/** Maps a shipping-callable failure to an i18n key under `sellerOrders.shipping.errors.*`/`orders.ndr.errors.*`. */
export function mapShippingErrorToI18nKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? ''
  switch (message) {
    case 'suborder_not_packed':
      return 'sellerOrders.shipping.errors.notPacked'
    case 'shipment_not_booked':
      return 'sellerOrders.shipping.errors.notBooked'
    case 'seller_origin_not_set':
      return 'sellerOrders.shipping.errors.originNotSet'
    case 'not_your_suborder':
      return 'orders.errors.permissionDenied'
    case 'no_open_ndr':
      return 'orders.ndr.errors.noOpenNdr'
    case 'not_your_order':
      return 'orders.errors.permissionDenied'
    default:
      return 'orders.errors.generic'
  }
}
