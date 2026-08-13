import { useTranslation } from 'react-i18next'
import { useSellerSettingsById } from '@/features/catalog/api/useSellerSettingsById'

interface SellerDisclosureCardProps {
  sellerId: string
  countryOfOrigin?: string
}

/**
 * Consumer Protection (E-Commerce) Rules, 2020, Rule 5(4) disclosure: seller
 * legal name + principal geographic address, and country of origin — shown
 * on every product page, not tucked into a tab, so it's visible without an
 * extra click. Reads `sellers/{sellerId}/settings/general` (public,
 * denormalized at approval time — see reviewSellerApplication.ts); renders
 * nothing if that data isn't set yet (e.g. a seller onboarded before Phase
 * 24) rather than showing a broken/empty block.
 */
export function SellerDisclosureCard({ sellerId, countryOfOrigin }: SellerDisclosureCardProps) {
  const { t } = useTranslation()
  const settingsQuery = useSellerSettingsById(sellerId)
  const settings = settingsQuery.data

  if (!settings?.legalName && !settings?.registeredAddress && !countryOfOrigin) return null

  return (
    <div className="mt-3 rounded-[6px] border border-steel/20 bg-surface-muted p-3 text-xs text-steel">
      <dl className="space-y-1">
        {settings?.legalName ? (
          <div>
            <dt className="inline font-medium text-ink">{t('product.detail.disclosure.soldBy')} </dt>
            <dd className="inline">{settings.legalName}</dd>
          </div>
        ) : null}
        {settings?.registeredAddress ? (
          <div>
            <dt className="inline font-medium text-ink">{t('product.detail.disclosure.address')} </dt>
            <dd className="inline">
              {[
                settings.registeredAddress.line1,
                settings.registeredAddress.line2,
                settings.registeredAddress.city,
                settings.registeredAddress.state,
                settings.registeredAddress.pincode,
              ]
                .filter(Boolean)
                .join(', ')}
            </dd>
          </div>
        ) : null}
        {settings?.gstin ? (
          <div>
            <dt className="inline font-medium text-ink">{t('product.detail.disclosure.gstin')} </dt>
            <dd className="inline font-mono">{settings.gstin}</dd>
          </div>
        ) : null}
        {countryOfOrigin ? (
          <div>
            <dt className="inline font-medium text-ink">{t('product.detail.disclosure.countryOfOrigin')} </dt>
            <dd className="inline">{countryOfOrigin}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}
