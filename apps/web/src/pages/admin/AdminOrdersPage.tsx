import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrderLookupPanel } from '@/features/admin/components/OrderLookupPanel'
import { PaymentReconciliationTable } from '@/features/admin/components/PaymentReconciliationTable'

type OrdersTab = 'lookup' | 'reconciliation'

export default function AdminOrdersPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<OrdersTab>('lookup')

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.orders')}</h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as OrdersTab)}>
        <TabsList aria-label={t('admin.nav.orders')}>
          <TabsTrigger value="lookup">{t('admin.orders.tabs.lookup')}</TabsTrigger>
          <TabsTrigger value="reconciliation">{t('admin.orders.tabs.reconciliation')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'lookup' ? <OrderLookupPanel /> : <PaymentReconciliationTable />}
    </div>
  )
}
