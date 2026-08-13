import type { SellerTrustTier } from '@snapspare/shared'
import { Award, ShieldCheck, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface SellerTrustBadgeProps {
  /** From `sellers/{id}/settings/general.trustTier` — the only trust-score field publicly readable (see sellerSettingsSchema's doc comment); the full breakdown is seller-private. */
  tier: SellerTrustTier | undefined
  className?: string
}

const TIER_STYLES: Record<string, string> = {
  new: 'bg-steel/10 text-steel',
  trusted: 'bg-verify/10 text-verify',
  top_rated: 'bg-signal/10 text-signal',
}

const TIER_ICONS: Record<string, typeof ShieldCheck> = {
  new: ShieldCheck,
  trusted: ShieldCheck,
  top_rated: Award,
}

/** Buyer-facing seller trust tier chip (design brief item 5) — New / Trusted / Top-rated, computed daily by computeSellerTrustScores.ts. Absent trustScore (not yet computed, e.g. a brand-new seller) renders nothing rather than a misleading default. */
export function SellerTrustBadge({ tier, className }: SellerTrustBadgeProps) {
  const { t } = useTranslation()
  if (!tier) return null

  const Icon = TIER_ICONS[tier] ?? ShieldCheck

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', TIER_STYLES[tier], className)}>
      {tier === 'top_rated' ? <Sparkles className="h-3 w-3" aria-hidden="true" /> : <Icon className="h-3 w-3" aria-hidden="true" />}
      {t(`trust.tier.${tier}`)}
    </span>
  )
}
