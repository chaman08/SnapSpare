import type {
  Listing,
  Order,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  SubOrder,
  SubOrderStatus,
} from '@snapspare/shared'
import { orderSchema, paymentSchema, subOrderSchema } from '@snapspare/shared'
import { BUYER_ADDRESSES } from '../data/buyerAddresses.js'
import { BUYER_BLUEPRINTS } from '../data/buyers.js'
import { SELLER_BLUEPRINTS } from '../data/sellers.js'
import { seedCollection } from '../lib/batch.js'
import { db } from '../lib/firebaseAdmin.js'
import { pickMany, randomInt, weightedBool } from '../lib/random.js'

const ORDERS_PER_BUYER = 4
const DAY_MS = 86_400_000

/** One purchased line item, surfaced to seedReviews/seedQa so they can attach reviews to real (buyer, listing, order) triples instead of fabricating their own. */
export interface DeliveredPurchase {
  orderId: string
  subOrderId: string
  listingId: string
  partId: string
  sellerId: string
  buyerId: string
  buyerDisplayName: string
}

interface LifecycleScenario {
  weight: number
  orderStatus: OrderStatus
  subOrderStatus: SubOrderStatus
  paymentStatus: PaymentStatus
}

const LIFECYCLES: LifecycleScenario[] = [
  { weight: 0.32, orderStatus: 'delivered', subOrderStatus: 'delivered', paymentStatus: 'paid' },
  { weight: 0.08, orderStatus: 'completed', subOrderStatus: 'delivered', paymentStatus: 'paid' },
  { weight: 0.14, orderStatus: 'shipped', subOrderStatus: 'shipped', paymentStatus: 'paid' },
  { weight: 0.14, orderStatus: 'processing', subOrderStatus: 'accepted', paymentStatus: 'paid' },
  { weight: 0.09, orderStatus: 'placed', subOrderStatus: 'pending', paymentStatus: 'paid' },
  { weight: 0.07, orderStatus: 'pending_payment', subOrderStatus: 'pending', paymentStatus: 'pending' },
  { weight: 0.09, orderStatus: 'cancelled', subOrderStatus: 'cancelled', paymentStatus: 'refunded' },
  { weight: 0.07, orderStatus: 'refunded', subOrderStatus: 'returned', paymentStatus: 'refunded' },
]

function weightedPick<T extends { weight: number }>(rng: () => number, items: readonly T[]): T {
  const roll = rng()
  let cumulative = 0
  for (const item of items) {
    cumulative += item.weight
    if (roll < cumulative) return item
  }
  return items[items.length - 1] as T
}

function unitPriceForQty(listing: Listing, qty: number): { unitPricePaise: number; tierMinQtyApplied: number } {
  let best = listing.pricing.tiers[0]!
  for (const tier of listing.pricing.tiers) {
    if (tier.minQty <= qty) best = tier
  }
  return { unitPricePaise: best.unitPricePaise, tierMinQtyApplied: best.minQty }
}

function pickPaymentMethod(rng: () => number, orderStatus: OrderStatus, hasCreditLine: boolean): PaymentMethod {
  // pending_payment orders are stuck waiting on a gateway redirect — cod/credit_line never touch the gateway.
  const gatewayOnly: PaymentMethod[] = ['upi', 'card', 'netbanking']
  if (orderStatus === 'pending_payment') return gatewayOnly[randomInt(rng, 0, gatewayOnly.length - 1)] as PaymentMethod

  const pool: PaymentMethod[] = ['upi', 'upi', 'card', 'card', 'netbanking', 'cod', 'cod']
  if (hasCreditLine) pool.push('credit_line')
  return pool[randomInt(rng, 0, pool.length - 1)] as PaymentMethod
}

export async function seedOrders(rng: () => number, listings: Listing[]): Promise<DeliveredPurchase[]> {
  const now = Date.now()
  const activeListings = listings.filter((listing) => listing.status === 'active')
  const listingsBySeller = new Map<string, Listing[]>()
  for (const listing of activeListings) {
    const bucket = listingsBySeller.get(listing.sellerId) ?? []
    bucket.push(listing)
    listingsBySeller.set(listing.sellerId, bucket)
  }
  const sellerIdsWithStock = SELLER_BLUEPRINTS.filter((seller) => (listingsBySeller.get(seller.id)?.length ?? 0) > 0)

  const orders: Order[] = []
  const subOrders: SubOrder[] = []
  const payments: Payment[] = []
  const deliveredPurchases: DeliveredPurchase[] = []

  for (const buyer of BUYER_BLUEPRINTS) {
    const address = BUYER_ADDRESSES.find((entry) => entry.buyerId === buyer.id)
    if (!address) continue

    for (let orderIndex = 0; orderIndex < ORDERS_PER_BUYER; orderIndex++) {
      const scenario = weightedPick(rng, LIFECYCLES)
      const orderId = `order-${buyer.id.replace('buyer-', '')}-${orderIndex + 1}`
      const sellerCount = weightedBool(rng, 0.25) ? 2 : 1
      const orderSellers = pickMany(rng, sellerIdsWithStock, sellerCount)
      const placedAt = now - randomInt(rng, 1, 150) * DAY_MS

      const orderSubOrderIds: string[] = []
      let orderSubtotal = 0
      let orderTax = 0
      let orderShipping = 0

      orderSellers.forEach((seller, sellerIndex) => {
        const sellerListings = listingsBySeller.get(seller.id) ?? []
        const chosenListings = pickMany(rng, sellerListings, randomInt(rng, 1, Math.min(3, sellerListings.length)))
        const subOrderId = `${orderId}-so${sellerIndex + 1}`

        const items = chosenListings.map((listing) => {
          const qty = listing.pricing.moq * randomInt(rng, 1, 3)
          const { unitPricePaise, tierMinQtyApplied } = unitPriceForQty(listing, qty)
          const lineSubtotalPaise = unitPricePaise * qty
          const lineTaxPaise = Math.round((lineSubtotalPaise * listing.gstRatePercent) / 100)
          return {
            listingId: listing.id,
            partId: listing.partId,
            sku: listing.sku,
            title: listing.title,
            qty,
            unitPricePaise,
            tierMinQtyApplied,
            hsnCode: listing.hsnCode,
            gstRatePercent: listing.gstRatePercent,
            lineSubtotalPaise,
            lineDiscountPaise: 0,
            lineTaxPaise,
            lineTotalPaise: lineSubtotalPaise + lineTaxPaise,
          }
        })

        const subtotalPaise = items.reduce((sum, item) => sum + item.lineSubtotalPaise, 0)
        const taxPaise = items.reduce((sum, item) => sum + item.lineTaxPaise, 0)
        const shippingPaise = weightedBool(rng, 0.6) ? 0 : randomInt(rng, 49, 99) * 100
        const totalPaise = subtotalPaise + taxPaise + shippingPaise
        const isInterState = seller.stateCode !== address.stateCode
        const cgstPaise = isInterState ? 0 : Math.round(taxPaise / 2)
        const sgstPaise = isInterState ? 0 : taxPaise - cgstPaise
        const igstPaise = isInterState ? taxPaise : 0

        const timeline = buildTimeline(scenario.subOrderStatus, placedAt)
        const shipment =
          scenario.subOrderStatus === 'shipped' ||
          scenario.subOrderStatus === 'out_for_delivery' ||
          scenario.subOrderStatus === 'delivered'
            ? {
                awb: `AWB${randomInt(rng, 100000000, 999999999)}`,
                courier: ['Delhivery', 'Bluedart', 'Ecom Express'][randomInt(rng, 0, 2)],
                shippedAt: placedAt + 1 * DAY_MS,
                deliveredAt: scenario.subOrderStatus === 'delivered' ? placedAt + 4 * DAY_MS : undefined,
              }
            : undefined

        const subOrder = subOrderSchema.parse({
          id: subOrderId,
          orderId,
          buyerId: buyer.id,
          sellerId: seller.id,
          status: scenario.subOrderStatus,
          purchasedPartIds: [...new Set(items.map((item) => item.partId))],
          shippingAddress: addressSnapshotFor(buyer.phone, address),
          items,
          subtotalPaise,
          discountPaise: 0,
          taxPaise,
          shippingPaise,
          totalPaise,
          isInterState,
          cgstPaise,
          sgstPaise,
          igstPaise,
          etaDaysMin: 2,
          etaDaysMax: 5,
          shipment,
          timeline,
          createdAt: placedAt,
          updatedAt: placedAt + timeline.length * DAY_MS,
        })
        subOrders.push(subOrder)
        orderSubOrderIds.push(subOrderId)
        orderSubtotal += subtotalPaise
        orderTax += taxPaise
        orderShipping += shippingPaise

        if (scenario.subOrderStatus === 'delivered') {
          for (const item of items) {
            deliveredPurchases.push({
              orderId,
              subOrderId,
              listingId: item.listingId,
              partId: item.partId,
              sellerId: seller.id,
              buyerId: buyer.id,
              buyerDisplayName: buyer.displayName.split(' ')[0] as string,
            })
          }
        }
      })

      const paymentMethod = pickPaymentMethod(rng, scenario.orderStatus, buyer.creditLimitPaise !== undefined)
      const couponApplied = scenario.orderStatus !== 'pending_payment' && weightedBool(rng, 0.2)
      const discountPaise = couponApplied ? Math.min(20000, Math.round(orderSubtotal * 0.1)) : 0
      const totalPaise = orderSubtotal - discountPaise + orderTax + orderShipping
      const orderTimeline = buildTimeline(scenario.orderStatus, placedAt)

      const order = orderSchema.parse({
        id: orderId,
        buyerId: buyer.id,
        buyerType: buyer.buyerType,
        status: scenario.orderStatus,
        subOrderIds: orderSubOrderIds,
        shippingAddress: addressSnapshotFor(buyer.phone, address),
        billingGstin: buyer.gstin,
        subtotalPaise: orderSubtotal,
        discountPaise,
        shippingPaise: orderShipping,
        taxPaise: orderTax,
        codFeePaise: paymentMethod === 'cod' ? 1500 : 0,
        totalPaise: totalPaise + (paymentMethod === 'cod' ? 1500 : 0),
        couponCode: couponApplied ? 'WELCOME10' : undefined,
        paymentMethod,
        paymentStatus: scenario.paymentStatus,
        idempotencyKey: `seed-${orderId}`,
        correlationId: `seed-corr-${orderId}`,
        reservationExpiresAt: scenario.orderStatus === 'pending_payment' ? now + 15 * 60_000 : undefined,
        confirmedAt: scenario.orderStatus === 'pending_payment' ? undefined : placedAt,
        cancelledReason: scenario.orderStatus === 'cancelled' ? 'payment_failed' : undefined,
        timeline: orderTimeline,
        placedAt,
        createdAt: placedAt,
        updatedAt: placedAt + orderTimeline.length * DAY_MS,
      })
      orders.push(order)

      if (paymentMethod !== 'cod' && paymentMethod !== 'credit_line') {
        const paymentStatusMap: Record<PaymentStatus, Payment['status']> = {
          pending: 'created',
          authorized: 'authorized',
          paid: 'captured',
          partially_refunded: 'partially_refunded',
          refunded: 'refunded',
          failed: 'failed',
        }
        const payment = paymentSchema.parse({
          id: `payment-${orderId}`,
          orderId,
          buyerId: buyer.id,
          gateway: 'razorpay',
          gatewayOrderId: `rzp_order_seed_${orderId}`,
          gatewayPaymentId:
            scenario.paymentStatus === 'pending' ? undefined : `rzp_payment_seed_${orderId}`,
          instrument: scenario.paymentStatus === 'pending' ? undefined : (paymentMethod as Payment['instrument']),
          status: paymentStatusMap[scenario.paymentStatus],
          amountPaise: order.totalPaise,
          amountRefundedPaise: scenario.paymentStatus === 'refunded' ? order.totalPaise : 0,
          failureReason: scenario.orderStatus === 'cancelled' ? 'Payment authorization declined by issuing bank' : undefined,
          webhookVerifiedAt: scenario.paymentStatus === 'pending' ? undefined : placedAt,
          createdAt: placedAt,
          updatedAt: placedAt,
        })
        payments.push(payment)
      }
    }
  }

  await seedCollection(db.collection('orders'), orders)
  await seedCollection(db.collection('subOrders'), subOrders)
  await seedCollection(db.collection('payments'), payments)
  console.log(`  orders: ${orders.length}, subOrders: ${subOrders.length}, payments: ${payments.length}`)

  return deliveredPurchases
}

function addressSnapshotFor(
  buyerPhone: string,
  address: (typeof BUYER_ADDRESSES)[number],
): Order['shippingAddress'] {
  return {
    contactName: address.contactName,
    contactPhone: buyerPhone,
    line1: address.line1,
    city: address.city,
    state: address.state,
    stateCode: address.stateCode,
    pincode: address.pincode,
  }
}

function buildTimeline(finalStatus: string, placedAt: number) {
  const progression: Record<string, string[]> = {
    pending: ['placed'],
    pending_payment: ['pending_payment'],
    placed: ['placed'],
    accepted: ['placed', 'confirmed', 'accepted'],
    processing: ['placed', 'confirmed', 'processing'],
    packed: ['placed', 'confirmed', 'packed'],
    shipped: ['placed', 'confirmed', 'packed', 'shipped'],
    out_for_delivery: ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery'],
    delivered: ['placed', 'confirmed', 'packed', 'shipped', 'delivered'],
    completed: ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'completed'],
    cancelled: ['placed', 'cancelled'],
    returned: ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'returned'],
    refunded: ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'returned', 'refunded'],
  }
  const steps = progression[finalStatus] ?? [finalStatus]
  return steps.map((status, index) => ({
    status,
    actor: { type: index === steps.length - 1 && status !== 'placed' ? 'system' : ('buyer' as const) },
    at: placedAt + index * DAY_MS,
  }))
}
