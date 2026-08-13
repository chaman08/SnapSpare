import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { type DashboardRangeDays, useSellerDailyStats } from '@/features/seller-dashboard/api/useSellerDailyStats'
import { useTodaysOrders } from '@/features/seller-dashboard/api/useTodaysOrders'
import { ConversionCard } from '@/features/seller-dashboard/components/ConversionCard'
import { MissedDemandPanel } from '@/features/seller-dashboard/components/MissedDemandPanel'
import { PendingActionsCard } from '@/features/seller-dashboard/components/PendingActionsCard'
import { RevenueChart } from '@/features/seller-dashboard/components/RevenueChart'
import { SlaScorecard } from '@/features/seller-dashboard/components/SlaScorecard'
import { TodaysOrders } from '@/features/seller-dashboard/components/TodaysOrders'
import { TopSellingParts } from '@/features/seller-dashboard/components/TopSellingParts'
import { useSellerListings } from '@/features/seller-listings/api/useSellerListings'
import { useSellerSubOrders } from '@/features/seller/api/useSellerSubOrders'
import { TrustScoreBreakdown } from '@/features/trust/components/TrustScoreBreakdown'

/** Requirement 6: today's orders, pending actions, revenue chart, top-selling parts, conversion, SLA scorecard, missed demand. */
export default function SellerDashboardPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const sellerId = claims?.sellerId
  const [rangeDays, setRangeDays] = useState<DashboardRangeDays>(30)

  const dailyStatsQuery = useSellerDailyStats(sellerId, rangeDays)
  const todaysOrdersQuery = useTodaysOrders(sellerId)
  const { subOrders: pendingSubOrders, loading: pendingLoading } = useSellerSubOrders(sellerId, ['pending', 'accepted'])
  const listingsQuery = useSellerListings(sellerId, 'all')

  const needsAcceptCount = useMemo(() => pendingSubOrders.filter((s) => s.status === 'pending').length, [pendingSubOrders])
  const needsPackCount = useMemo(() => pendingSubOrders.filter((s) => s.status === 'accepted').length, [pendingSubOrders])
  const totalViewCount = useMemo(
    () => (listingsQuery.data ?? []).reduce((sum, listing) => sum + listing.viewCount, 0),
    [listingsQuery.data],
  )

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('sellerDashboard.title')}</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PendingActionsCard needsAcceptCount={needsAcceptCount} needsPackCount={needsPackCount} isLoading={pendingLoading} />
        <ConversionCard stats={dailyStatsQuery.data ?? []} totalViewCount={totalViewCount} isLoading={dailyStatsQuery.isLoading} />
      </div>

      <RevenueChart
        stats={dailyStatsQuery.data ?? []}
        isLoading={dailyStatsQuery.isLoading}
        isError={dailyStatsQuery.isError}
        onRetry={() => dailyStatsQuery.refetch()}
        rangeDays={rangeDays}
        onRangeChange={setRangeDays}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopSellingParts
          stats={dailyStatsQuery.data ?? []}
          isLoading={dailyStatsQuery.isLoading}
          isError={dailyStatsQuery.isError}
          onRetry={() => dailyStatsQuery.refetch()}
        />
        <SlaScorecard stats={dailyStatsQuery.data ?? []} isLoading={dailyStatsQuery.isLoading} />
      </div>

      <TodaysOrders
        subOrders={todaysOrdersQuery.data ?? []}
        isLoading={todaysOrdersQuery.isLoading}
        isError={todaysOrdersQuery.isError}
        onRetry={() => todaysOrdersQuery.refetch()}
      />

      <MissedDemandPanel sellerId={sellerId} />

      <div className="rounded-[6px] border border-steel/20 p-4">
        <h2 className="mb-3 font-heading text-lg font-semibold text-ink">{t('trust.breakdown.title')}</h2>
        <TrustScoreBreakdown sellerId={sellerId} />
      </div>
    </div>
  )
}
