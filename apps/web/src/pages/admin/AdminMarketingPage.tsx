import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BannersPanel } from '@/features/admin/components/BannersPanel'
import { CampaignsPanel } from '@/features/admin/components/CampaignsPanel'
import { CouponsPanel } from '@/features/admin/components/CouponsPanel'
import { HomeSectionsPanel } from '@/features/admin/components/HomeSectionsPanel'

type MarketingTab = 'coupons' | 'banners' | 'campaigns' | 'homeSections'

export default function AdminMarketingPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<MarketingTab>('coupons')

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.marketing')}</h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as MarketingTab)}>
        <TabsList aria-label={t('admin.nav.marketing')}>
          <TabsTrigger value="coupons">{t('admin.marketing.tabs.coupons')}</TabsTrigger>
          <TabsTrigger value="banners">{t('admin.marketing.tabs.banners')}</TabsTrigger>
          <TabsTrigger value="campaigns">{t('admin.marketing.tabs.campaigns')}</TabsTrigger>
          <TabsTrigger value="homeSections">{t('admin.marketing.tabs.homeSections')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'coupons' && <CouponsPanel />}
      {tab === 'banners' && <BannersPanel />}
      {tab === 'campaigns' && <CampaignsPanel />}
      {tab === 'homeSections' && <HomeSectionsPanel />}
    </div>
  )
}
