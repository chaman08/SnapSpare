import type { ListingGenuineBadge } from '@snapspare/shared'
import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface GenuinePartBadgeProps {
  badge: ListingGenuineBadge | undefined
}

/** "Genuine part" badge (design brief item 4) — never rendered unless the listing's genuineBadge.verified is true, which functions/src/trust never sets without a verified brandAuthorization document. Shows the document's own verification date, per the product brief. */
export function GenuinePartBadge({ badge }: GenuinePartBadgeProps) {
  const { t } = useTranslation()
  if (!badge?.verified) return null

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-verify/10 px-2.5 py-1 text-xs font-medium text-verify">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{t('trust.genuineBadge.label')}</span>
      {badge.verifiedAt ? (
        <span className="text-verify/70">
          · {t('trust.genuineBadge.verifiedOn', { date: new Date(badge.verifiedAt).toLocaleDateString() })}
        </span>
      ) : null}
    </div>
  )
}
