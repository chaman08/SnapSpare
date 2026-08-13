import { formatINR } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type DashboardPeriodDays, useAdminDashboardMetrics } from '@/features/admin/api/dashboardActions'
import { DashboardAlertTiles } from '@/features/admin/components/DashboardAlertTiles'
import { DashboardMetricTile } from '@/features/admin/components/DashboardMetricTile'
import { NewOrdersFeed } from '@/features/admin/components/NewOrdersFeed'

const PERIOD_OPTIONS: DashboardPeriodDays[] = [7, 30, 90]

export default function AdminDashboardPage() {
  const { t } = useTranslation()
  const [periodDays, setPeriodDays] = useState<DashboardPeriodDays>(30)
  const { data, isLoading, isError, refetch } = useAdminDashboardMetrics(periodDays)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.dashboard')}</h1>
        <Tabs value={String(periodDays)} onValueChange={(value) => setPeriodDays(Number(value) as DashboardPeriodDays)}>
          <TabsList aria-label={t('admin.dashboard.periodLabel')}>
            {PERIOD_OPTIONS.map((days) => (
              <TabsTrigger key={days} value={String(days)}>
                {t('admin.dashboard.periodDays', { count: days })}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DashboardMetricTile label={t('admin.dashboard.metrics.gmv')} value={formatINR(data.gmvPaise.current)} changePercent={data.gmvPaise.changePercent} />
            <DashboardMetricTile label={t('admin.dashboard.metrics.orders')} value={data.orderCount.current.toLocaleString('en-IN')} changePercent={data.orderCount.changePercent} />
            <DashboardMetricTile label={t('admin.dashboard.metrics.aov')} value={formatINR(Math.round(data.aovPaise.current))} changePercent={data.aovPaise.changePercent} />
            <DashboardMetricTile label={t('admin.dashboard.metrics.takeRate')} value={`${data.takeRatePercent.current.toFixed(1)}%`} changePercent={data.takeRatePercent.changePercent} />
            <DashboardMetricTile label={t('admin.dashboard.metrics.newBuyers')} value={data.newBuyers.current.toLocaleString('en-IN')} changePercent={data.newBuyers.changePercent} />
            <DashboardMetricTile label={t('admin.dashboard.metrics.newSellers')} value={data.newSellers.current.toLocaleString('en-IN')} changePercent={data.newSellers.changePercent} />
            <DashboardMetricTile label={t('admin.dashboard.metrics.repeatRate')} value={`${data.repeatRatePercent.current.toFixed(1)}%`} changePercent={data.repeatRatePercent.changePercent} />
            <DashboardMetricTile
              label={t('admin.dashboard.metrics.paymentSuccessRate')}
              value={`${data.paymentSuccessRatePercent.current.toFixed(1)}%`}
              changePercent={data.paymentSuccessRatePercent.changePercent}
            />
          </div>

          <div>
            <h2 className="mb-2 font-heading text-lg font-semibold text-ink">{t('admin.dashboard.alertsTitle')}</h2>
            <DashboardAlertTiles alerts={data.alerts} />
          </div>

          <NewOrdersFeed />
        </>
      )}
    </div>
  )
}
