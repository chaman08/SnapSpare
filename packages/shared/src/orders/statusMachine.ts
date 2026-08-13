import type { SubOrderStatus } from '../enums'

export type SubOrderActorRole = 'buyer' | 'seller' | 'admin' | 'system'

/**
 * The single source of truth for which subOrder status transitions exist and
 * who may trigger them. Every transition Cloud Function in
 * functions/src/orders/ calls `assertSubOrderTransition` before writing —
 * never the client, never a Firestore rule (see firestore.rules'
 * `subOrders/{subOrderId}`: write: false). Shared here so buyer/seller UI can
 * use the exact same table to decide which action buttons to show, without
 * duplicating (and inevitably drifting from) the server's rules.
 */
export const SUB_ORDER_TRANSITIONS: Record<SubOrderStatus, Partial<Record<SubOrderStatus, SubOrderActorRole[]>>> = {
  pending: {
    accepted: ['seller'],
    rejected: ['seller'],
    cancelled: ['buyer', 'seller', 'system'],
  },
  accepted: {
    packed: ['seller'],
    cancelled: ['buyer', 'seller'],
  },
  packed: {
    shipped: ['seller'],
    cancelled: ['buyer', 'seller'],
  },
  shipped: {
    out_for_delivery: ['seller', 'admin', 'system'],
  },
  out_for_delivery: {
    delivered: ['seller', 'admin', 'system'],
  },
  delivered: {
    returned: ['seller', 'admin'],
  },
  rejected: {},
  cancelled: {},
  returned: {},
  refunded: {},
}

export function isSubOrderTransitionAllowed(
  from: SubOrderStatus,
  to: SubOrderStatus,
  actor: SubOrderActorRole,
): boolean {
  const allowedActors = SUB_ORDER_TRANSITIONS[from]?.[to]
  return allowedActors !== undefined && allowedActors.includes(actor)
}

/** subOrder statuses a buyer/seller cancel action may originate from — always before the item ships. */
export const CANCELLABLE_SUB_ORDER_STATUSES: SubOrderStatus[] = ['pending', 'accepted', 'packed']

/** Terminal statuses — a subOrder in one of these never transitions again. */
export const TERMINAL_SUB_ORDER_STATUSES: SubOrderStatus[] = ['rejected', 'cancelled', 'returned', 'refunded']
