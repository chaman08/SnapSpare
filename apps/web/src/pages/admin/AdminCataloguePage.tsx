import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BrandsPanel } from '@/features/admin/components/BrandsPanel'
import { CatalogPartsPanel } from '@/features/admin/components/CatalogPartsPanel'
import { CatalogueBulkImportPanel } from '@/features/admin/components/CatalogueBulkImportPanel'
import { CategoriesPanel } from '@/features/admin/components/CategoriesPanel'

type CatalogueTab = 'parts' | 'brands' | 'categories' | 'bulkImport'

export default function AdminCataloguePage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<CatalogueTab>('parts')

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.catalogue')}</h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as CatalogueTab)}>
        <TabsList aria-label={t('admin.nav.catalogue')}>
          <TabsTrigger value="parts">{t('admin.catalogue.tabs.parts')}</TabsTrigger>
          <TabsTrigger value="brands">{t('admin.catalogue.tabs.brands')}</TabsTrigger>
          <TabsTrigger value="categories">{t('admin.catalogue.tabs.categories')}</TabsTrigger>
          <TabsTrigger value="bulkImport">{t('admin.catalogue.tabs.bulkImport')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'parts' && <CatalogPartsPanel />}
      {tab === 'brands' && <BrandsPanel />}
      {tab === 'categories' && <CategoriesPanel />}
      {tab === 'bulkImport' && <CatalogueBulkImportPanel />}
    </div>
  )
}
