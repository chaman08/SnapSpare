import type { CommissionConfig, CommissionPromotion } from '../schemas/commissionConfig'
import type { Paise } from '../types/money'
import { applyPercent } from '../types/money'

export interface CommissionComputationInput {
  taxableValuePaise: Paise
  categorySlug?: string
  sellerId: string
  /** `sellerSchema.commissionRatePercent` — a per-seller override, checked ahead of the category rate but behind an active promotion. */
  sellerOverridePercent?: number
  /** Platform-wide fallback — `config/app.platformCommissionDefaultPercent`, used when no category rate matches. */
  platformDefaultPercent: number
  now: number
}

export interface CommissionResult {
  /** Which precedence tier supplied the rate — surfaced for the ledger entry's description/audit trail. */
  source: 'promotion' | 'seller_override' | 'category' | 'platform_default'
  percent: number
  percentAmountPaise: Paise
  flatFeePaise: Paise
  totalPaise: Paise
}

function findActivePromotion(
  promotions: CommissionPromotion[],
  input: Pick<CommissionComputationInput, 'sellerId' | 'categorySlug' | 'now'>,
): CommissionPromotion | undefined {
  return promotions.find((promo) => {
    if (input.now < promo.startAt || input.now > promo.endAt) return false
    if (promo.scope === 'seller') return promo.sellerId === input.sellerId
    if (promo.scope === 'category') return promo.categorySlug !== undefined && promo.categorySlug === input.categorySlug
    return promo.scope === 'platform'
  })
}

/**
 * Resolves the applicable commission rate — an active promotional window
 * (seller/category/platform-wide zero-commission or discounted period) beats
 * a per-seller override, which beats the seller's category rate, which beats
 * the platform default — then applies it to the taxable value plus an
 * optional flat fee. Same shape as pricing/tax.ts's computeTcs/computeTds:
 * a pure function over already-resolved config, called from
 * functions/src/payments/applyCommissionOnDelivered.ts (design brief item 4,
 * "applied at delivery, not order placement").
 */
export function computeCommission(input: CommissionComputationInput, config: CommissionConfig): CommissionResult {
  const promotion = findActivePromotion(config.promotions, input)
  const categoryRate = input.categorySlug ? config.categoryRates[input.categorySlug] : undefined

  let percent: number
  let flatFeePaise: Paise
  let source: CommissionResult['source']

  if (promotion) {
    percent = promotion.percent
    flatFeePaise = 0
    source = 'promotion'
  } else if (input.sellerOverridePercent !== undefined) {
    percent = input.sellerOverridePercent
    flatFeePaise = 0
    source = 'seller_override'
  } else if (categoryRate) {
    percent = categoryRate.percent
    flatFeePaise = categoryRate.flatFeePaise ?? 0
    source = 'category'
  } else {
    percent = input.platformDefaultPercent
    flatFeePaise = 0
    source = 'platform_default'
  }

  const percentAmountPaise = applyPercent(input.taxableValuePaise, percent)
  return {
    source,
    percent,
    percentAmountPaise,
    flatFeePaise,
    totalPaise: percentAmountPaise + flatFeePaise,
  }
}
