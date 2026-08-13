import { z } from 'zod'

export const orderStatusSchema = z.enum([
  'pending_payment',
  'placed',
  'confirmed',
  'processing',
  'partially_shipped',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'refunded',
])
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const subOrderStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
])
export type SubOrderStatus = z.infer<typeof subOrderStatusSchema>

export const paymentMethodSchema = z.enum([
  'razorpay',
  'upi',
  'card',
  'netbanking',
  'cod',
  'credit_line',
])
export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const paymentStatusSchema = z.enum([
  'pending',
  'authorized',
  'paid',
  'partially_refunded',
  'refunded',
  'failed',
])
export type PaymentStatus = z.infer<typeof paymentStatusSchema>

export const buyerTypeSchema = z.enum(['retail', 'mechanic', 'garage', 'fleet', 'reseller'])
export type BuyerType = z.infer<typeof buyerTypeSchema>

export const sellerStatusSchema = z.enum([
  'pending_verification',
  'active',
  'suspended',
  'rejected',
  'deactivated',
])
export type SellerStatus = z.infer<typeof sellerStatusSchema>

export const listingStatusSchema = z.enum([
  'draft',
  'active',
  'paused',
  'out_of_stock',
  'rejected',
  'archived',
])
export type ListingStatus = z.infer<typeof listingStatusSchema>

export const returnReasonSchema = z.enum([
  'wrong_part_sent',
  'doesnt_fit',
  'damaged_in_transit',
  'defective',
  'suspected_spurious',
  'changed_mind',
  /** System-raised, never buyer-chosen — set by processRtoRefund.ts when the courier reports the parcel returned-to-origin after repeated failed delivery attempts. */
  'rto_undelivered',
])
export type ReturnReason = z.infer<typeof returnReasonSchema>

export const warrantyClaimReasonSchema = z.enum([
  'premature_failure',
  'manufacturing_defect',
  'not_as_warranted',
  'other',
])
export type WarrantyClaimReason = z.infer<typeof warrantyClaimReasonSchema>

export const partConditionSchema = z.enum(['new', 'used', 'refurbished'])
export type PartCondition = z.infer<typeof partConditionSchema>

export const partTypeSchema = z.enum(['oem', 'oes', 'aftermarket', 'genuine'])
export type PartType = z.infer<typeof partTypeSchema>

export const vehicleClassSchema = z.enum([
  'two_wheeler',
  'three_wheeler',
  'passenger_car',
  'suv',
  'commercial_light',
  'commercial_heavy',
  'tractor',
])
export type VehicleClass = z.infer<typeof vehicleClassSchema>
