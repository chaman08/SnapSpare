import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FitmentBulkImportPanel } from '@/features/admin/components/FitmentBulkImportPanel'
import { FitmentWorkbench } from '@/features/admin/components/FitmentWorkbench'

type FitmentTab = 'workbench' | 'bulkImport'

export default function AdminFitmentPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<FitmentTab>('workbench')

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.fitment')}</h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as FitmentTab)}>
        <TabsList aria-label={t('admin.nav.fitment')}>
          <TabsTrigger value="workbench">{t('admin.fitment.tabs.workbench')}</TabsTrigger>
          <TabsTrigger value="bulkImport">{t('admin.fitment.tabs.bulkImport')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'workbench' ? <FitmentWorkbench /> : <FitmentBulkImportPanel />}
    </div>
  )
}
