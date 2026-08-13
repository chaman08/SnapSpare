import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import type { FunnelStepResult } from '@/features/admin/api/useAnalyticsFunnel'

interface FunnelChartProps {
  steps: FunnelStepResult[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

/** search → view_item_list → view_item → add_to_cart → view_cart → begin_checkout → add_payment_info → purchase, one bar per step, with a drop-off % called out under each bar after the first. Single series (GMV/count, not identity) — one hue, no legend needed, matching RevenueChart's precedent. */
export function FunnelChart({ steps, isLoading, isError, onRetry }: FunnelChartProps) {
  const { t } = useTranslation()

  if (isLoading) return <Skeleton className="h-72 w-full" />
  if (isError) return <ErrorState onRetry={onRetry} />
  if (!steps || steps.every((s) => s.count === 0)) return <EmptyState title={t('admin.analytics.funnel.empty')} />

  const chartData = steps.map((s) => ({
    step: t(`admin.analytics.funnel.steps.${s.step}`),
    count: s.count,
    dropOffPercent: s.dropOffPercent,
  }))

  return (
    <div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--steel) / 0.15)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'rgb(var(--steel))' }} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="step"
              width={140}
              tick={{ fontSize: 12, fill: 'rgb(var(--ink))' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value: number) => [value.toLocaleString('en-IN'), t('admin.analytics.funnel.countLabel')]}
              contentStyle={{ borderRadius: 6, borderColor: 'rgb(var(--steel) / 0.3)', fontSize: 12 }}
            />
            <Bar dataKey="count" fill="rgb(var(--signal))" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-steel sm:grid-cols-4">
        {steps.map((s) => (
          <div key={s.step} className="contents">
            <dt className="truncate">{t(`admin.analytics.funnel.steps.${s.step}`)}</dt>
            <dd className="text-right font-mono text-ink">
              {s.dropOffPercent === null ? '—' : t('admin.analytics.funnel.dropOff', { percent: s.dropOffPercent })}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
