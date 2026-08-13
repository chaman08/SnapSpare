import { initializeApp } from 'firebase-admin/app'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onRequest } from 'firebase-functions/v2/https'
import { initSentry } from './monitoring/sentry.js'

initializeApp()
initSentry()

setGlobalOptions({ region: 'asia-south1', maxInstances: 10 })

/**
 * Scaffold-only health check so `firebase deploy --only functions` and the
 * emulator suite have something real to boot.
 */
export const ping = onRequest((req, res) => {
  res.json({ ok: true, service: 'snapspare-functions', region: 'asia-south1' })
})

export { onUserCreate } from './auth/onUserCreate.js'
export { setUserRole } from './auth/setUserRole.js'
export { onSellerStatusChange } from './auth/onSellerStatusChange.js'
export { verifyGstin } from './auth/verifyGstin.js'
export { lookupPincode } from './address/lookupPincode.js'
export { checkFitment } from './fitment/checkFitment.js'
export { lookupVehicleByReg } from './vehicle/lookupVehicleByReg.js'
export { createSearchKey } from './search/createSearchKey.js'
export { onListingWrite } from './search/onListingWrite.js'
export { onCatalogPartWrite } from './search/onCatalogPartWrite.js'
export { processSearchIndexQueue } from './search/processSearchIndexQueue.js'
export { onSubOrderDelivered } from './recommendation/onSubOrderDelivered.js'
export { logPartCoView } from './recommendation/logPartCoView.js'
export { priceCart } from './cart/priceCart.js'
export { resolveBulkOrder } from './cart/resolveBulkOrder.js'
export { checkServiceability } from './checkout/checkServiceability.js'
export { createOrder } from './checkout/createOrder.js'
export { confirmPayment } from './checkout/confirmPayment.js'
export { razorpayWebhook } from './checkout/razorpayWebhook.js'
export { releaseExpiredReservations } from './checkout/releaseExpiredReservations.js'

// Phase 9: order lifecycle — subOrder status machine, order aggregation,
// seller SLA auto-cancel, and the return refund flow.
export { acceptSubOrder } from './orders/acceptSubOrder.js'
export { rejectSubOrder } from './orders/rejectSubOrder.js'
export { packSubOrder } from './orders/packSubOrder.js'
export { shipSubOrder } from './orders/shipSubOrder.js'
export { updateShipmentStatus } from './orders/updateShipmentStatus.js'
export { cancelSubOrder } from './orders/cancelSubOrder.js'
export { bulkAcceptSubOrders } from './orders/bulkAcceptSubOrders.js'
export { onSubOrderStatusChange } from './orders/aggregateOrderStatus.js'
export { autoCancelUnacceptedSubOrders } from './orders/autoCancelUnacceptedSubOrders.js'
export { requestReturn } from './orders/requestReturn.js'
export { refundReturn } from './orders/refundReturn.js'
export { onReturnStatusChange } from './orders/onReturnStatusChange.js'

// Phase 10: shipping & logistics — provider adapter (Shiprocket + dev mock),
// admin-configurable rate/zone model, label generation + pickup scheduling,
// webhook + polling tracking, NDR/RTO handling.
export { getShippingRates } from './shipping/getShippingRates.js'
export { bookShipment } from './shipping/bookShipment.js'
export { schedulePickup } from './shipping/schedulePickup.js'
export { generateShippingLabel } from './shipping/generateShippingLabel.js'
export { cancelShipment } from './shipping/cancelShipment.js'
export { requestNdrReattempt } from './shipping/requestNdrReattempt.js'
export { shiprocketWebhook } from './shipping/shiprocketWebhook.js'
export { reconcileAwbTracking } from './shipping/reconcileAwbTracking.js'

// Phase 11: GST invoicing and compliance — sequential per-seller invoice
// numbering, PDF generation on shipment, TCS (Sec 52) / TDS (Sec 194-O)
// ledger postings, credit notes on returns, e-way-bill task flagging +
// exportable JSON/CSV, and admin GSTR-1/TCS/TDS/GMV reports. Tax rates and
// thresholds are configuration (config/tax), not constants — see the
// README's "Tax compliance" section before go-live.
export { generateInvoiceOnShipped } from './tax/generateInvoiceOnShipped.js'
export { generateCreditNoteOnReturnRefunded } from './tax/generateCreditNoteOnReturnRefunded.js'
export { getInvoiceUrl } from './tax/getInvoiceUrl.js'
export { getCreditNoteUrl } from './tax/getCreditNoteUrl.js'
export { markEwayBillGenerated } from './tax/markEwayBillGenerated.js'
export { getGstr1SummaryReport } from './tax/reports/getGstr1SummaryReport.js'
export { getTcsSummaryReport } from './tax/reports/getTcsSummaryReport.js'
export { getTdsSummaryReport } from './tax/reports/getTdsSummaryReport.js'
export { getGmvTaxReport } from './tax/reports/getGmvTaxReport.js'
export { exportEwayBillTasks } from './tax/reports/exportEwayBillTasks.js'

// Phase 12: payments, refunds, seller payouts and credit. The Razorpay
// webhook (razorpayWebhook, exported above) now also handles refund.processed/
// refund.failed/order.paid and Khata repayments, and persists every raw
// delivery to webhookEvents before processing. Commission is computed and
// posted to the seller ledger at delivery (not order placement); refunds
// route through a single refundEngine used by every cancel/reject/return/RTO
// path; seller settlement runs on a schedule; buyer Khata credit has a full
// admin-approval / statement / reminder / auto-block / repayment lifecycle.
// See the README and this phase's plan doc for the mock-only payout-provider
// swap point (functions/src/payments/provider.ts) that still needs a real
// bank-transfer API wired in before production launch.
export { submitRefundBankDetails } from './payments/submitRefundBankDetails.js'
export { applyCommissionOnDelivered } from './payments/applyCommissionOnDelivered.js'
export { runSellerPayouts } from './payments/runSellerPayouts.js'
export { getPayoutStatement } from './payments/getPayoutStatement.js'
export { requestCreditLimit } from './credit/requestCreditLimit.js'
export { approveCreditLimit } from './credit/approveCreditLimit.js'
export { createCreditRepaymentLink } from './credit/createCreditRepaymentLink.js'
export { generateMonthlyStatement } from './credit/generateMonthlyStatement.js'
export { creditDueReminders } from './credit/creditDueReminders.js'
export { autoBlockOverdueCredit } from './credit/autoBlockOverdueCredit.js'

// Phase 13: seller registration & verification — draft-persisted onboarding
// wizard (sellerApplications/{ownerUserId}), admin review queue, staff
// invites with a role/permission matrix, and post-approval seller settings
// (holiday mode, SLA/notification preferences). sellerId == ownerUserId by
// design — see packages/shared/src/schemas/sellerApplication.ts.
export { submitSellerApplication } from './seller/submitSellerApplication.js'
export { reviewSellerApplication } from './seller/reviewSellerApplication.js'
export { getSellerKycDocumentUrls } from './seller/getSellerKycDocumentUrls.js'
export { checkPickupPincodeServiceability } from './seller/checkPickupPincodeServiceability.js'
export { inviteSellerStaff } from './seller/inviteSellerStaff.js'
export { acceptSellerStaffInvite } from './seller/acceptSellerStaffInvite.js'
export { removeSellerStaff } from './seller/removeSellerStaff.js'
export { setHolidayMode } from './seller/setHolidayMode.js'

// Phase 14: seller listing management. Listing create/update/status-change
// all go through these callables (Admin SDK, bypasses firestore.rules) so
// listingPricingSchema's deep tier-ladder invariants — which rules can't
// practically re-check — are always enforced server-side; see
// functions/src/listings/persistListing.ts's header comment.
export { saveListing } from './listings/saveListing.js'
export { updateListingStatus } from './listings/updateListingStatus.js'
export { onListingStockAutoStatus } from './listings/onListingStockAutoStatus.js'

// Phase 14: a second, independent Typesense collection/sync pipeline
// (catalog_parts) powering the seller-facing "Add listing" typeahead —
// deliberately parallel to, not sharing code with, the listings search
// pipeline above (search for a catalog part directly, not per-seller
// listings of one). See catalogPartSearchCollectionSchema.ts.
export { onCatalogPartWriteSearch } from './search/onCatalogPartWriteSearch.js'
export { processCatalogPartSearchIndexQueue } from './search/processCatalogPartSearchIndexQueue.js'
export { createCatalogPartSearchKey } from './search/createCatalogPartSearchKey.js'
export { getCommissionRatePreview } from './pricing/getCommissionRatePreview.js'
export { applyPricingTemplate, deletePricingTemplate, savePricingTemplate } from './listings/pricingTemplates.js'
export { submitPartRequest } from './listings/submitPartRequest.js'
export { reviewPartRequest } from './listings/reviewPartRequest.js'
export { adjustStock } from './listings/adjustStock.js'
export { checkLowStockAndNotify } from './listings/checkLowStockAndNotify.js'

// Phase 14 M7: bulk operations — spreadsheet upload (parse is a dry-run,
// commit re-parses the same file rather than trusting client-held state)
// plus the bulk price/stock/status mutators, all manage_listings-gated.
export { parseBulkListingUpload } from './listings/parseBulkListingUpload.js'
export { commitBulkListingUpload } from './listings/commitBulkListingUpload.js'
export { bulkPriceChange } from './listings/bulkPriceChange.js'
export { bulkStockUpdate } from './listings/bulkStockUpdate.js'
export { bulkStatusChange } from './listings/bulkStatusChange.js'

// Phase 14 M8: seller dashboard — daily rollup feeds the revenue chart and
// SLA scorecard (a client-side scan of raw subOrders for 7/30/90-day
// ranges doesn't scale); missed-demand is a seller-scoped view over the
// otherwise admin-only searchMisses collection.
export { rollupSellerDailyStats } from './seller/rollupSellerDailyStats.js'
export { getMissedDemandForSeller } from './seller/getMissedDemandForSeller.js'

// Phase 14 M9: public store page — atomic handle claim, same "claim a
// unique username" shape as any such feature.
export { setStoreSlug } from './seller/setStoreSlug.js'

// Phase 15: Request for Quote — buyer creates an rfq (routed to matching
// sellers with a response window), sellers submit/withdraw quotes, the
// buyer accepts one (converting it into a normal order with a locked
// one-off price, never mutating the public listing) or withdraws the whole
// rfq, a scheduled sweep expires stale rfqs/quotes, and a per-quote message
// thread is moderated server-side for phone-number/email sharing.
export { createRfq } from './rfq/createRfq.js'
export { withdrawRfq } from './rfq/withdrawRfq.js'
export { submitRfqQuote } from './rfq/submitRfqQuote.js'
export { withdrawRfqQuote } from './rfq/withdrawRfqQuote.js'
export { acceptRfqQuote } from './rfq/acceptRfqQuote.js'
export { expireRfqs } from './rfq/expireRfqs.js'
export { sendRfqMessage } from './rfq/sendRfqMessage.js'

// Phase 16: multi-channel notifications. dispatchNotification fans every
// freshly-queued notificationsQueue doc (written by queueNotification/
// queueNotificationDirect across every earlier phase) out over its eligible
// external channels (WhatsApp Cloud API, MSG91 SMS, FCM web push, Resend
// email) — in-app display needs no dispatch, the queue doc IS the in-app
// notification. retryFailedNotifications sweeps per-channel retries with
// exponential backoff, dead-lettering after 5 attempts. sendSlaBreachWarnings
// and sendAbandonedCartReminders queue two new event types at existing
// hook points (see subOrder.slaAcceptByAt / cart.updatedAt). Preferences are
// canonical per-user (notificationPreferences/{userId}), with a hard rule:
// transactional types always send; only the small marketing set
// (price_drop/back_in_stock/abandoned_cart) respects opt-out, IST quiet
// hours, and the per-channel daily rate cap.
export { dispatchNotification } from './notifications/dispatchNotification.js'
export { retryFailedNotifications } from './notifications/retryFailedNotifications.js'
export { sendSlaBreachWarnings } from './notifications/sendSlaBreachWarnings.js'
export { sendAbandonedCartReminders } from './notifications/sendAbandonedCartReminders.js'
export { registerFcmToken } from './notifications/registerFcmToken.js'
export { unregisterFcmToken } from './notifications/unregisterFcmToken.js'
export { markNotificationRead } from './notifications/markNotificationRead.js'
export { markAllNotificationsRead } from './notifications/markAllNotificationsRead.js'
export { updateNotificationPreferences } from './notifications/updateNotificationPreferences.js'

// Phase 17: trust systems. Reviews are tied to a verified, delivered
// purchase (onSubOrderDeliveredReviewEligibility) and a 3-day WhatsApp
// nudge (sendReviewRequests); onReviewWrite auto-screens new reviews for
// profanity/contact-info/PII (auto-publishing clean ones, flagging the
// rest for moderateReview's admin queue) and recomputes Bayesian rating
// aggregates on the listing/catalogPart/seller whenever a review is or was
// published — see packages/shared/src/trust/bayesian.ts for why a single
// 5-star review can't outrank a well-evidenced lower average. Anti-
// counterfeit: reportSpuriousPart/respondToSpuriousReport/
// resolveSpuriousReport run the admin investigation workflow and its
// penalty ladder (warning -> listing_removal -> category_ban ->
// payout_hold -> delisting); submitBrandAuthorization/
// reviewBrandAuthorization/onBrandAuthorizationWrite back the "Genuine
// part" badge, never awarded without a verified document;
// verifyPartAuthenticity is the QR/hologram adapter hook (mock-only, see
// functions/src/trust/authenticityProvider.ts). computeSellerTrustScores
// composes rating/SLA/cancellation/return/spurious/tenure into a daily
// buyer-facing trust tier. answerQuestion tightens Q&A answering to
// sellers who actually stock the part and buyers who actually bought it
// (Cloud-Function-only now, like the RFQ message thread before it).
export { onSubOrderDeliveredReviewEligibility } from './reviews/onSubOrderDeliveredReviewEligibility.js'
export { sendReviewRequests } from './reviews/sendReviewRequests.js'
export { onReviewWrite } from './reviews/onReviewWrite.js'
export { respondToReview } from './reviews/respondToReview.js'
export { moderateReview } from './reviews/moderateReview.js'
export { answerQuestion } from './qa/answerQuestion.js'
export { reportSpuriousPart } from './trust/reportSpuriousPart.js'
export { respondToSpuriousReport } from './trust/respondToSpuriousReport.js'
export { resolveSpuriousReport } from './trust/resolveSpuriousReport.js'
export { getSpuriousReportEvidenceUrls } from './trust/getSpuriousReportEvidenceUrls.js'
export { submitBrandAuthorization } from './trust/submitBrandAuthorization.js'
export { reviewBrandAuthorization } from './trust/reviewBrandAuthorization.js'
export { onBrandAuthorizationWrite } from './trust/onBrandAuthorizationWrite.js'
export { verifyPartAuthenticity } from './trust/verifyPartAuthenticity.js'
export { computeSellerTrustScores } from './trust/computeSellerTrustScores.js'

// Phase 18: post-sale resolution. Returns now go through a full
// requested -> approved (reverse pickup booked, see
// shipping/shippingProvider.ts's createReversePickup) -> qc_passed/
// qc_disputed -> refunded/replaced lifecycle instead of the old direct-
// client approve/reject (see firestore.rules' `returns` collection header
// comment); decideReturn/submitReturnQc/autoPassReturnQc replace that path,
// with resolveReturnQcPass.ts as the one shared refund-or-replacement
// resolver both the manual and auto-pass paths call. Warranty claims are a
// separate, longer-window claim/review/brand-escalation flow (admin-
// mediated only — no brand-contact directory exists). Disputes escalate a
// QC disagreement or a rejected warranty claim to admin, with a full
// evidence timeline, an SLA clock, and a forced-resolution action that can
// refund the buyer and debit the seller ledger (a mandatory admin note
// required by resolveDisputeRequestSchema, tagged `dispute_refund_debit` to
// stay distinguishable from an ordinary return refund). Buyer-abuse
// controls reuse the existing codAbuseFlag COD gate (auto-set by
// processRtoRefund.ts past config/returns.rtoAutoCodBlockThreshold) plus a
// new admin-visible return-rate flag (flagReturnAbuseBuyers.ts).
export { decideReturn } from './orders/decideReturn.js'
export { submitReturnQc } from './orders/submitReturnQc.js'
export { autoPassReturnQc } from './orders/autoPassReturnQc.js'
export { flagReturnAbuseBuyers } from './orders/flagReturnAbuseBuyers.js'
export { getReturnEvidenceUrls } from './orders/getReturnEvidenceUrls.js'
export { submitWarrantyClaim } from './warranty/submitWarrantyClaim.js'
export { decideWarrantyClaim } from './warranty/decideWarrantyClaim.js'
export { onWarrantyClaimWrite } from './warranty/onWarrantyClaimWrite.js'
export { getWarrantyClaimEvidenceUrls } from './warranty/getWarrantyClaimEvidenceUrls.js'
export { openDispute } from './disputes/openDispute.js'
export { addDisputeEvidence } from './disputes/addDisputeEvidence.js'
export { resolveDispute } from './disputes/resolveDispute.js'
export { sendDisputeSlaBreachWarnings } from './disputes/sendDisputeSlaBreachWarnings.js'

// Phase 19: admin console. Every mutating callable below calls
// writeAuditLog() (functions/src/util/auditLog.ts) after its write succeeds
// — the design brief's "audit log on every mutating action" requirement.
// New Phase-19 Firestore collections (brands, categories, banners,
// campaigns, cmsPages, stringOverrides, payoutRuns, impersonationSessions,
// fitmentReports, auditLogs) are Cloud-Function-only for writes (see
// firestore.rules' Phase 19 section) specifically so a direct admin client
// write can never bypass the audit trail.
export { getAdminDashboardMetrics } from './admin/getAdminDashboardMetrics.js'
export { adminUpdateSeller } from './seller/adminUpdateSeller.js'
export { adminForceOrderAction } from './orders/adminForceOrderAction.js'
export { getPaymentReconciliationReport } from './orders/getPaymentReconciliationReport.js'
export { triggerPayoutRun } from './payments/triggerPayoutRun.js'
export { updateCommissionConfig } from './pricing/updateCommissionConfig.js'
export { saveBrand } from './catalogue/saveBrand.js'
export { saveCategory } from './catalogue/saveCategory.js'
export { adminSaveCatalogPart } from './catalogue/adminSaveCatalogPart.js'
export { bulkImportCatalogParts } from './catalogue/bulkImportCatalogParts.js'
export { adminSaveCatalogFitment } from './fitment/adminSaveCatalogFitment.js'
export { bulkImportCatalogFitments } from './fitment/bulkImportCatalogFitments.js'
export { adminSetListingStatus } from './listings/adminSetListingStatus.js'
export { getListingAnomalyReport } from './listings/getListingAnomalyReport.js'
export { saveCoupon } from './marketing/saveCoupon.js'
export { saveBanner } from './marketing/saveBanner.js'
export { saveCampaign } from './marketing/saveCampaign.js'
export { sendCampaign } from './marketing/sendCampaign.js'
export { saveCmsPage } from './content/saveCmsPage.js'
export { setStringOverride } from './content/setStringOverride.js'
export { adminSetUserFlags } from './users/adminSetUserFlags.js'
export { startImpersonation } from './users/startImpersonation.js'
export { requestAccountDeletion } from './users/requestAccountDeletion.js'
export { registerDeviceFingerprint } from './abuse/registerDeviceFingerprint.js'

// Phase 20: growth features. Homepage sections follow the exact Phase 19
// pattern — admin-console-only writes funneled through a callable that calls
// writeAuditLog() (see firestore.rules' Phase 20 section for the matching
// Cloud-Function-only collections: homeSections, homepageComputed).
export { saveHomeSection } from './marketing/saveHomeSection.js'
export { reorderHomeSections } from './marketing/reorderHomeSections.js'
export { computeBulkBuySpotlight } from './marketing/computeBulkBuySpotlight.js'

// Phase 22: discoverability & measurement. SEO — a daily sitemap rollup +
// the onRequest function that serves it (see firebase.json's hosting
// rewrites), and a weekly auto-generated long-tail landing-page content job
// (generateSeoLandingPages, see that file's header comment on scope/caps).
// Analytics — logFunnelEvent is the one client-callable write in this
// group (schema-validated, unauthenticated by design); everything else is a
// scheduled rollup reading authoritative order/subOrder data. Monitoring —
// withSentry (functions/src/monitoring/withSentry.ts) wraps createOrder and
// the payment webhook as the first two call sites; see that file's header
// comment on why it isn't applied everywhere yet.
export { rollupSitemap } from './seo/rollupSitemap.js'
export { sitemapXml } from './seo/sitemapXml.js'
export { generateSeoLandingPages } from './marketing/generateSeoLandingPages.js'
export { logFunnelEvent } from './analytics/logFunnelEvent.js'
export { reconcileFunnelPurchases } from './analytics/reconcileFunnelPurchases.js'
export { rollupSlabEffectivenessDaily } from './analytics/rollupSlabEffectivenessDaily.js'
export { rollupCohortRetention } from './analytics/rollupCohortRetention.js'

// Phase 23: quality & security pass. scheduledFirestoreBackup runs a weekly
// managed Firestore export (see that file's header comment for the GCS
// bucket/IAM prerequisites a human operator must set up per environment,
// and docs/runbooks/ for the rollback and restore-drill procedures this
// phase also adds).
export { scheduledFirestoreBackup } from './admin/scheduledFirestoreBackup.js'

// Phase 24: launch readiness. Support ticketing (contact form) is modelled
// directly on Phase 18's disputes — createSupportTicket is the one
// unauthenticated-friendly write path in this group (a guest can file a
// ticket before signing in), respondToSupportTicket/resolveSupportTicket are
// admin-only, and sendSupportTicketSlaBreachWarnings pages every admin ahead
// of the config/app.supportTicketSlaHours deadline, same pattern as
// sendDisputeSlaBreachWarnings. See README's Phase 24 section for the legal
// pages (seeded CmsPage content, not Cloud Functions), the ops runbooks, and
// the monitoring/soft-launch docs this phase also adds under docs/.
export { createSupportTicket } from './support/createSupportTicket.js'
export { respondToSupportTicket } from './support/respondToSupportTicket.js'
export { resolveSupportTicket } from './support/resolveSupportTicket.js'
export { sendSupportTicketSlaBreachWarnings } from './support/sendSupportTicketSlaBreachWarnings.js'
