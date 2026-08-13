import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CommissionPlanEditor } from '@/features/admin/components/CommissionPlanEditor'
import { LedgerExplorer } from '@/features/admin/components/LedgerExplorer'
import { PayoutsPanel } from '@/features/admin/components/PayoutsPanel'
import { RefundRegister } from '@/features/admin/components/RefundRegister'

type FinanceTab = 'commission' | 'payouts' | 'ledger' | 'refunds'

export default function AdminFinancePage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<FinanceTab>('commission')

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.finance')}</h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as FinanceTab)}>
        <TabsList aria-label={t('admin.nav.finance')}>
          <TabsTrigger value="commission">{t('admin.finance.tabs.commission')}</TabsTrigger>
          <TabsTrigger value="payouts">{t('admin.finance.tabs.payouts')}</TabsTrigger>
          <TabsTrigger value="ledger">{t('admin.finance.tabs.ledger')}</TabsTrigger>
          <TabsTrigger value="refunds">{t('admin.finance.tabs.refunds')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'commission' && <CommissionPlanEditor />}
      {tab === 'payouts' && <PayoutsPanel />}
      {tab === 'ledger' && <LedgerExplorer />}
      {tab === 'refunds' && <RefundRegister />}
    </div>
  )
}
