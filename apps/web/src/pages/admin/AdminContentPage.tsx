import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CmsPagesPanel } from '@/features/admin/components/CmsPagesPanel'
import { StringOverridesPanel } from '@/features/admin/components/StringOverridesPanel'

type ContentTab = 'pages' | 'strings'

export default function AdminContentPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ContentTab>('pages')

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.content')}</h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as ContentTab)}>
        <TabsList aria-label={t('admin.nav.content')}>
          <TabsTrigger value="pages">{t('admin.content.tabs.pages')}</TabsTrigger>
          <TabsTrigger value="strings">{t('admin.content.tabs.strings')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'pages' ? <CmsPagesPanel /> : <StringOverridesPanel />}
    </div>
  )
}
