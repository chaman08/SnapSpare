import {
  type GetCommissionRatePreviewResult,
  computeCommission,
  getCommissionRatePreviewRequestSchema,
  sellerSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getAppConfig } from '../checkout/appConfig.js'
import { getCommissionConfig } from '../payments/commissionConfig.js'
import { requireSellerPermission } from '../seller/staffAuthz.js'

/**
 * manage_listings-gated. Returns only the effective {percent, source} per
 * requested category — never the raw `config/commission` doc (categoryRates
 * and promotions are competitively sensitive, now admin-read-only in
 * firestore.rules). Reuses `computeCommission()` verbatim, the exact same
 * precedence logic `applyCommissionOnDelivered.ts` uses at settlement time,
 * so the SlabPricingEditor's margin calculator never drifts from what a
 * seller is actually charged.
 */
export const getCommissionRatePreview = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<GetCommissionRatePreviewResult> => {
    const sellerId = requireSellerPermission(request, 'manage_listings')

    const parsed = getCommissionRatePreviewRequestSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
    }

    const db = getFirestore()
    const sellerSnapshot = await db.collection('sellers').doc(sellerId).get()
    if (!sellerSnapshot.exists) throw new HttpsError('not-found', 'seller_not_found')
    const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })

    const [appConfig, commissionConfig] = await Promise.all([getAppConfig(), getCommissionConfig()])
    const now = Date.now()

    const rates: GetCommissionRatePreviewResult['rates'] = {}
    for (const categorySlug of parsed.data.categorySlugs) {
      const result = computeCommission(
        {
          taxableValuePaise: 0,
          categorySlug,
          sellerId,
          sellerOverridePercent: seller.commissionRatePercent,
          platformDefaultPercent: appConfig.platformCommissionDefaultPercent,
          now,
        },
        commissionConfig,
      )
      rates[categorySlug] = { percent: result.percent, source: result.source }
    }

    return { rates }
  },
)
