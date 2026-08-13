import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ListingAnomalyReportPanel } from '@/features/admin/components/ListingAnomalyReportPanel'
import { ListingsSearchPanel } from '@/features/admin/components/ListingsSearchPanel'

type ListingsTab = 'search' | 'anomalies'

export default function AdminListingsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ListingsTab>('search')

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.listings')}</h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as ListingsTab)}>
        <TabsList aria-label={t('admin.nav.listings')}>
          <TabsTrigger value="search">{t('admin.listings.tabs.search')}</TabsTrigger>
          <TabsTrigger value="anomalies">{t('admin.listings.tabs.anomalies')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'search' ? <ListingsSearchPanel /> : <ListingAnomalyReportPanel />}
    </div>
  )
}
