import type { SubOrderStatus } from '@snapspare/shared'

export type TrackingOutcome =
  | { kind: 'transition'; status: SubOrderStatus }
  | { kind: 'ndr'; reasonCode: string }
  | { kind: 'rto_delivered' }
  | { kind: 'unmapped' }

/**
 * Maps a raw Shiprocket status string (also used verbatim by
 * mockShippingProvider.ts, so the mock and the real provider exercise the
 * same table) to a normalized outcome — one place both
 * shiprocketWebhook.ts and reconcileAwbTracking.ts interpret tracking
 * data, so the two paths can never disagree about what a given status
 * means. Shiprocket's status vocabulary is large and not fully
 * enumerable here; anything not recognized maps to `'unmapped'` and is
 * safely ignored rather than guessed at.
 */
export function mapProviderStatus(rawStatus: string): TrackingOutcome {
  const status = rawStatus.trim().toUpperCase()

  if (['PICKED UP', 'IN TRANSIT', 'SHIPPED', 'DISPATCHED'].includes(status)) {
    return { kind: 'transition', status: 'shipped' }
  }
  if (['OUT FOR DELIVERY'].includes(status)) {
    return { kind: 'transition', status: 'out_for_delivery' }
  }
  if (['DELIVERED'].includes(status)) {
    return { kind: 'transition', status: 'delivered' }
  }
  if (['UNDELIVERED', 'NDR', 'DELIVERY FAILED', 'CANCELLED FROM COURIER PANEL'].includes(status)) {
    return { kind: 'ndr', reasonCode: status }
  }
  if (['RTO DELIVERED', 'RTO COMPLETE'].includes(status)) {
    return { kind: 'rto_delivered' }
  }

  return { kind: 'unmapped' }
}
