import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { useSellerSettings } from '@/features/seller/api/useSellerSettings'
import { HolidayModeToggle } from '@/features/seller/components/HolidayModeToggle'
import { NotificationPreferencesForm } from '@/features/seller/components/NotificationPreferencesForm'
import { SlaPreferencesForm } from '@/features/seller/components/SlaPreferencesForm'
import { StorePageForm } from '@/features/seller/components/StorePageForm'
import { BrandAuthorizationForm } from '@/features/trust/components/BrandAuthorizationForm'

export default function SellerSettingsPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const sellerId = claims?.sellerId
  const { settings, loading } = useSellerSettings(sellerId)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('sellerSettings.pageTitle')}</h1>
      {loading || !sellerId ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          <StorePageForm sellerId={sellerId} initial={settings ?? null} />
          <HolidayModeToggle initial={settings?.holidayMode} />
          <SlaPreferencesForm sellerId={sellerId} initial={settings?.slaPreferences} />
          <NotificationPreferencesForm sellerId={sellerId} initial={settings?.notificationPreferences} />
          <BrandAuthorizationForm sellerId={sellerId} />
        </>
      )}
    </div>
  )
}
