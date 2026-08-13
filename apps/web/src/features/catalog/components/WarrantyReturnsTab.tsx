import type { Listing } from '@snapspare/shared'
import { AlertTriangle, ShieldCheck, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useReturnsConfig } from '@/features/checkout/api/useReturnsConfig'

interface WarrantyReturnsTabProps {
  listing: Listing
  /** From the listing's catalogPart — checked against config/returns.nonReturnableSubcategorySlugs so a part like a sensor/ECU states loudly, before purchase, that it can't be returned once fitted (design brief item 2). */
  subcategorySlug: string | undefined
}

/** Warranty/return terms for the currently selected listing — these are seller-set, so they change when the buyer picks a different row in SellerComparisonStrip. */
export function WarrantyReturnsTab({ listing, subcategorySlug }: WarrantyReturnsTabProps) {
  const { t } = useTranslation()
  const { config } = useReturnsConfig()
  const nonReturnable = Boolean(subcategorySlug && config?.nonReturnableSubcategorySlugs.includes(subcategorySlug))

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {nonReturnable ? (
        <div className="flex items-start gap-2 rounded-[6px] border border-alert bg-alert/10 p-4 sm:col-span-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-alert" aria-hidden="true" />
          <p className="text-sm font-medium text-alert">{t('product.detail.warrantyReturns.nonReturnable')}</p>
        </div>
      ) : null}

      <div className="rounded-[6px] border border-steel/20 p-4">
        <p className="mb-1 inline-flex items-center gap-1.5 font-medium text-ink">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {t('product.detail.warrantyReturns.warrantyTitle')}
        </p>
        <p className="text-sm text-steel">
          {listing.warrantyMonths
            ? t('product.detail.warrantyMonths', { count: listing.warrantyMonths })
            : t('product.detail.warrantyReturns.noWarranty')}
        </p>
      </div>

      <div className="rounded-[6px] border border-steel/20 p-4">
        <p className="mb-1 inline-flex items-center gap-1.5 font-medium text-ink">
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          {t('product.detail.warrantyReturns.returnsTitle')}
        </p>
        <p className="text-sm text-steel">
          {nonReturnable
            ? t('product.detail.warrantyReturns.nonReturnableShort')
            : listing.returnWindowDays
              ? t('product.detail.returnWindow', { count: listing.returnWindowDays })
              : t('product.detail.warrantyReturns.noReturns')}
        </p>
      </div>

      <p className="text-xs text-steel sm:col-span-2">{t('product.detail.warrantyReturns.disclaimer')}</p>
    </div>
  )
}
