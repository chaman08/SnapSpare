import { type ReturnsConfig, returnsConfigSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'

const DEFAULT_RETURNS_CONFIG: Omit<ReturnsConfig, 'id' | 'updatedAt'> = {
  categoryReturnWindowDaysOverride: {},
  nonReturnableSubcategorySlugs: ['sensors', 'ecus'],
  buyerFaultReasons: ['changed_mind'],
  buyerFaultShippingFeePaise: 9900,
  qcAutoPassDays: 5,
  disputeSlaHours: 48,
  returnRateAbuseThresholdPercent: 30,
  returnRateAbuseWindowDays: 90,
  returnRateAbuseMinOrders: 5,
  rtoAutoCodBlockThreshold: 3,
  fairUsePolicy: {
    en: 'Frequent returns or refused Cash on Delivery orders may lead to Cash on Delivery being disabled or return requests requiring manual review on your account.',
    hi: 'बार-बार रिटर्न या कैश ऑन डिलीवरी ऑर्डर अस्वीकार करने पर आपके खाते पर कैश ऑन डिलीवरी बंद की जा सकती है या रिटर्न अनुरोधों की मैन्युअल समीक्षा आवश्यक हो सकती है।',
  },
}

/**
 * Reads `config/returns` (the Phase 18 post-sale policy engine — per-category
 * return windows, non-returnable subcategories, buyer/seller-fault shipping
 * deduction, QC auto-pass window, dispute SLA, buyer-abuse thresholds),
 * falling back to `DEFAULT_RETURNS_CONFIG` when no admin has customized it
 * yet. Same safe-default treatment as commissionConfig.ts's
 * getCommissionConfig — money-adjacent but not payment-blocking.
 */
export async function getReturnsConfig(): Promise<ReturnsConfig> {
  const snapshot = await getFirestore().collection('config').doc('returns').get()
  if (!snapshot.exists) {
    return { id: 'returns', ...DEFAULT_RETURNS_CONFIG, updatedAt: 0 }
  }
  return returnsConfigSchema.parse({ id: snapshot.id, ...snapshot.data() })
}
