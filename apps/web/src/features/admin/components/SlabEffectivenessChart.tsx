import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import type { SlabBucketResult } from '@/features/admin/api/useSlabEffectiveness'

interface SlabEffectivenessChartProps {
  buckets: SlabBucketResult[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

/** GMV by minimum-quantity tier applied — see rollupSlabEffectivenessDaily.ts's header comment on why buckets are keyed by the raw tierMinQtyApplied value rather than each listing's ordinal tier position. */
export function SlabEffectivenessChart({ buckets, isLoading, isError, onRetry }: SlabEffectivenessChartProps) {
  const { t } = useTranslation()

  if (isLoading) return <Skeleton className="h-72 w-full" />
  if (isError) return <ErrorState onRetry={onRetry} />
  if (!buckets || buckets.length === 0) return <EmptyState title={t('admin.analytics.slab.empty')} />

  const chartData = buckets.map((b) => ({
    tier: t('admin.analytics.slab.tierLabel', { qty: b.tierMinQtyApplied }),
    gmvRupees: Math.round(b.gmvPaise / 100),
    gmvSharePercent: b.gmvSharePercent,
  }))

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--steel) / 0.15)" />
          <XAxis dataKey="tier" tick={{ fontSize: 11, fill: 'rgb(var(--steel))' }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: 'rgb(var(--steel))' }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => `₹${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`}
          />
          <Tooltip
            formatter={(value: number, _name, item) => [
              `${formatINR(value * 100)} (${item.payload.gmvSharePercent}%)`,
              t('admin.analytics.slab.gmvLabel'),
            ]}
            contentStyle={{ borderRadius: 6, borderColor: 'rgb(var(--steel) / 0.3)', fontSize: 12 }}
          />
          <Bar dataKey="gmvRupees" fill="rgb(var(--verify))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
