import { z } from 'zod'

/**
 * These were originally zod `.brand()`-ed for nominal typing (so a SellerId
 * couldn't be passed where a ListingId is expected), but tsup's `.d.ts`
 * bundler silently drops the brand marker when `packages/shared` is
 * consumed from `apps/web`/`functions` — it round-trips fine inside this
 * package, but arrives as a plain `string` on the other side of the
 * package boundary, which is worse than not branding at all (false sense
 * of safety). Plain validated strings instead.
 */
export const userIdSchema = z.string().min(1)
export type UserId = z.infer<typeof userIdSchema>

export const addressIdSchema = z.string().min(1)
export type AddressId = z.infer<typeof addressIdSchema>

export const garageVehicleIdSchema = z.string().min(1)
export type GarageVehicleId = z.infer<typeof garageVehicleIdSchema>

export const sellerIdSchema = z.string().min(1)
export type SellerId = z.infer<typeof sellerIdSchema>

export const sellerStaffIdSchema = z.string().min(1)
export type SellerStaffId = z.infer<typeof sellerStaffIdSchema>

/** Equal to the owner's userId by design — see sellerApplication.ts's header comment. */
export const sellerApplicationIdSchema = z.string().min(1)
export type SellerApplicationId = z.infer<typeof sellerApplicationIdSchema>

export const partIdSchema = z.string().min(1)
export type PartId = z.infer<typeof partIdSchema>

export const catalogFitmentIdSchema = z.string().min(1)
export type CatalogFitmentId = z.infer<typeof catalogFitmentIdSchema>

export const listingIdSchema = z.string().min(1)
export type ListingId = z.infer<typeof listingIdSchema>

export const vehicleMakeIdSchema = z.string().min(1)
export type VehicleMakeId = z.infer<typeof vehicleMakeIdSchema>

export const vehicleModelIdSchema = z.string().min(1)
export type VehicleModelId = z.infer<typeof vehicleModelIdSchema>

export const vehicleVariantIdSchema = z.string().min(1)
export type VehicleVariantId = z.infer<typeof vehicleVariantIdSchema>

export const cartIdSchema = z.string().min(1)
export type CartId = z.infer<typeof cartIdSchema>

export const orderIdSchema = z.string().min(1)
export type OrderId = z.infer<typeof orderIdSchema>

export const subOrderIdSchema = z.string().min(1)
export type SubOrderId = z.infer<typeof subOrderIdSchema>

export const rfqIdSchema = z.string().min(1)
export type RfqId = z.infer<typeof rfqIdSchema>

export const rfqQuoteIdSchema = z.string().min(1)
export type RfqQuoteId = z.infer<typeof rfqQuoteIdSchema>

export const rfqMessageIdSchema = z.string().min(1)
export type RfqMessageId = z.infer<typeof rfqMessageIdSchema>

export const returnIdSchema = z.string().min(1)
export type ReturnId = z.infer<typeof returnIdSchema>

export const reviewIdSchema = z.string().min(1)
export type ReviewId = z.infer<typeof reviewIdSchema>

export const couponIdSchema = z.string().min(1)
export type CouponId = z.infer<typeof couponIdSchema>

export const payoutIdSchema = z.string().min(1)
export type PayoutId = z.infer<typeof payoutIdSchema>

export const ledgerIdSchema = z.string().min(1)
export type LedgerId = z.infer<typeof ledgerIdSchema>

export const ledgerEntryIdSchema = z.string().min(1)
export type LedgerEntryId = z.infer<typeof ledgerEntryIdSchema>

export const creditAccountIdSchema = z.string().min(1)
export type CreditAccountId = z.infer<typeof creditAccountIdSchema>

export const paymentIdSchema = z.string().min(1)
export type PaymentId = z.infer<typeof paymentIdSchema>

export const notificationIdSchema = z.string().min(1)
export type NotificationId = z.infer<typeof notificationIdSchema>

export const slaBreachIdSchema = z.string().min(1)
export type SlaBreachId = z.infer<typeof slaBreachIdSchema>

export const invoiceIdSchema = z.string().min(1)
export type InvoiceId = z.infer<typeof invoiceIdSchema>

export const creditNoteIdSchema = z.string().min(1)
export type CreditNoteId = z.infer<typeof creditNoteIdSchema>

export const ewayBillTaskIdSchema = z.string().min(1)
export type EwayBillTaskId = z.infer<typeof ewayBillTaskIdSchema>

export const webhookEventIdSchema = z.string().min(1)
export type WebhookEventId = z.infer<typeof webhookEventIdSchema>

export const refundBankDetailIdSchema = z.string().min(1)
export type RefundBankDetailId = z.infer<typeof refundBankDetailIdSchema>

export const creditLimitChangeIdSchema = z.string().min(1)
export type CreditLimitChangeId = z.infer<typeof creditLimitChangeIdSchema>

export const creditLimitRequestIdSchema = z.string().min(1)
export type CreditLimitRequestId = z.infer<typeof creditLimitRequestIdSchema>

export const creditStatementIdSchema = z.string().min(1)
export type CreditStatementId = z.infer<typeof creditStatementIdSchema>

export const notificationDeadLetterIdSchema = z.string().min(1)
export type NotificationDeadLetterId = z.infer<typeof notificationDeadLetterIdSchema>

export const spuriousReportIdSchema = z.string().min(1)
export type SpuriousReportId = z.infer<typeof spuriousReportIdSchema>

export const brandAuthorizationIdSchema = z.string().min(1)
export type BrandAuthorizationId = z.infer<typeof brandAuthorizationIdSchema>

export const qaQuestionIdSchema = z.string().min(1)
export type QaQuestionId = z.infer<typeof qaQuestionIdSchema>

export const qaAnswerIdSchema = z.string().min(1)
export type QaAnswerId = z.infer<typeof qaAnswerIdSchema>

export const authenticityScanIdSchema = z.string().min(1)
export type AuthenticityScanId = z.infer<typeof authenticityScanIdSchema>

export const warrantyClaimIdSchema = z.string().min(1)
export type WarrantyClaimId = z.infer<typeof warrantyClaimIdSchema>

export const disputeIdSchema = z.string().min(1)
export type DisputeId = z.infer<typeof disputeIdSchema>

export const homeSectionIdSchema = z.string().min(1)
export type HomeSectionId = z.infer<typeof homeSectionIdSchema>

/** Phase 22 SEO. Doc id is the composite slug itself (categorySlug__subcategorySlug__vehicleSlug) — see seoLandingPage.ts. */
export const seoLandingPageIdSchema = z.string().min(1)
export type SeoLandingPageId = z.infer<typeof seoLandingPageIdSchema>

/** Phase 24: launch readiness — support ticketing (contact form). */
export const supportTicketIdSchema = z.string().min(1)
export type SupportTicketId = z.infer<typeof supportTicketIdSchema>
