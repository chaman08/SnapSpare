import type { BuyerType, FunnelSegment } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AnalyticsRangeDays } from '@/features/admin/api/useAnalyticsFunnel'
import { useAnalyticsFunnel } from '@/features/admin/api/useAnalyticsFunnel'
import { useCohortRetention } from '@/features/admin/api/useCohortRetention'
import { useSlabEffectiveness } from '@/features/admin/api/useSlabEffectiveness'
import { CohortRetentionHeatmap } from '@/features/admin/components/CohortRetentionHeatmap'
import { FunnelChart } from '@/features/admin/components/FunnelChart'
import { SlabEffectivenessChart } from '@/features/admin/components/SlabEffectivenessChart'

const RANGE_OPTIONS: AnalyticsRangeDays[] = [7, 30, 90]
const BUYER_TYPES: BuyerType[] = ['retail', 'mechanic', 'garage', 'fleet', 'reseller']

/**
 * Phase 22 requirement 2: funnel (search → product → cart → checkout →
 * payment → purchase, with a buyerType segment filter and drop-off %),
 * slab-effectiveness (GMV by quantity tier — the report used to tune the
 * pricing ladders), and cohort retention by buyer type, in one page since
 * all three are read-only views over small precomputed rollup docs (see
 * functions/src/analytics/) rather than three separate live-aggregation
 * surfaces.
 */
export default function AdminAnalyticsPage() {
  const { t } = useTranslation()
  const [rangeDays, setRangeDays] = useState<AnalyticsRangeDays>(30)
  const [funnelSegment, setFunnelSegment] = useState<FunnelSegment>('all')
  const [cohortBuyerType, setCohortBuyerType] = useState<BuyerType>('retail')
  const [activeTab, setActiveTab] = useState('funnel')

  const funnelQuery = useAnalyticsFunnel(rangeDays, funnelSegment)
  const slabQuery = useSlabEffectiveness(rangeDays)
  const cohortQuery = useCohortRetention(cohortBuyerType)

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.analytics.title')}</h1>
        <Tabs value={String(rangeDays)} onValueChange={(v) => setRangeDays(Number(v) as AnalyticsRangeDays)}>
          <TabsList aria-label={t('admin.analytics.rangeLabel')}>
            {RANGE_OPTIONS.map((days) => (
              <TabsTrigger key={days} value={String(days)}>
                {t('sellerDashboard.revenueChart.rangeDays', { count: days })}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList aria-label={t('admin.analytics.title')}>
          <TabsTrigger value="funnel">{t('admin.analytics.funnel.tabLabel')}</TabsTrigger>
          <TabsTrigger value="slab">{t('admin.analytics.slab.tabLabel')}</TabsTrigger>
          <TabsTrigger value="cohort">{t('admin.analytics.cohort.tabLabel')}</TabsTrigger>
        </TabsList>

        <TabsContent value="funnel">
          <section className="rounded-[6px] border border-steel/20 bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-semibold text-ink">{t('admin.analytics.funnel.tabLabel')}</h2>
              <Select value={funnelSegment} onValueChange={(v) => setFunnelSegment(v as FunnelSegment)}>
                <SelectTrigger className="w-48" aria-label={t('admin.analytics.segmentLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.analytics.segmentAll')}</SelectItem>
                  {BUYER_TYPES.map((bt) => (
                    <SelectItem key={bt} value={bt}>
                      {t(`auth.buyerType.${bt}`, bt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FunnelChart
              steps={funnelQuery.data}
              isLoading={funnelQuery.isLoading}
              isError={funnelQuery.isError}
              onRetry={() => funnelQuery.refetch()}
            />
          </section>
        </TabsContent>

        <TabsContent value="slab">
          <section className="rounded-[6px] border border-steel/20 bg-surface p-4">
            <h2 className="mb-3 font-heading text-lg font-semibold text-ink">{t('admin.analytics.slab.tabLabel')}</h2>
            <SlabEffectivenessChart
              buckets={slabQuery.data?.buckets}
              isLoading={slabQuery.isLoading}
              isError={slabQuery.isError}
              onRetry={() => slabQuery.refetch()}
            />
          </section>
        </TabsContent>

        <TabsContent value="cohort">
          <section className="rounded-[6px] border border-steel/20 bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-semibold text-ink">{t('admin.analytics.cohort.tabLabel')}</h2>
              <Select value={cohortBuyerType} onValueChange={(v) => setCohortBuyerType(v as BuyerType)}>
                <SelectTrigger className="w-48" aria-label={t('admin.analytics.segmentLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUYER_TYPES.map((bt) => (
                    <SelectItem key={bt} value={bt}>
                      {t(`auth.buyerType.${bt}`, bt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CohortRetentionHeatmap
              cohorts={cohortQuery.data}
              isLoading={cohortQuery.isLoading}
              isError={cohortQuery.isError}
              onRetry={() => cohortQuery.refetch()}
            />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
