import type { SellerDailyStats } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DashboardRangeDays } from '@/features/seller-dashboard/api/useSellerDailyStats'

interface RevenueChartProps {
  stats: SellerDailyStats[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  rangeDays: DashboardRangeDays
  onRangeChange: (days: DashboardRangeDays) => void
}

const RANGE_OPTIONS: DashboardRangeDays[] = [7, 30, 90]

export function RevenueChart({ stats, isLoading, isError, onRetry, rangeDays, onRangeChange }: RevenueChartProps) {
  const { t } = useTranslation()

  const chartData = stats.map((day) => ({ date: day.date, revenueRupees: Math.round(day.revenuePaise / 100) }))
  const totalRevenuePaise = stats.reduce((sum, day) => sum + day.revenuePaise, 0)

  return (
    <section className="rounded-[6px] border border-steel/20 bg-surface p-4" aria-labelledby="revenue-chart-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="revenue-chart-heading" className="font-heading text-lg font-semibold text-ink">
            {t('sellerDashboard.revenueChart.title')}
          </h2>
          <p className="font-mono text-xl text-ink" aria-live="polite">
            {formatINR(totalRevenuePaise)}
          </p>
        </div>
        <Tabs value={String(rangeDays)} onValueChange={(value) => onRangeChange(Number(value) as DashboardRangeDays)}>
          <TabsList aria-label={t('sellerDashboard.revenueChart.rangeLabel')}>
            {RANGE_OPTIONS.map((days) => (
              <TabsTrigger key={days} value={String(days)}>
                {t('sellerDashboard.revenueChart.rangeDays', { count: days })}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : chartData.length === 0 ? (
          <EmptyState title={t('sellerDashboard.revenueChart.emptyTitle')} />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--signal))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="rgb(var(--signal))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--steel) / 0.15)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'rgb(var(--steel))' }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: 'rgb(var(--steel))' }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(value: number) => `₹${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`}
                />
                <Tooltip
                  formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, t('sellerDashboard.revenueChart.title')]}
                  contentStyle={{ borderRadius: 6, borderColor: 'rgb(var(--steel) / 0.3)', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenueRupees"
                  stroke="rgb(var(--signal))"
                  strokeWidth={2}
                  fill="url(#revenueFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  )
}
