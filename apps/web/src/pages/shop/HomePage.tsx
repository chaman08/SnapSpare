import { buildOrganizationJsonLd } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { HomeSectionRenderer } from '@/features/home/components/HomeSectionRenderer'
import { useHomeSections } from '@/features/home/api/useHomeSections'
import { useSeoTags } from '@/lib/seo/useSeoTags'

function HomePageSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-56 w-full rounded-[6px]" />
      <Skeleton className="h-24 w-full rounded-[6px]" />
      <Skeleton className="h-64 w-full rounded-[6px]" />
    </div>
  )
}

/** Growth module (Phase 20 design brief item 1) — the homepage is entirely admin-configured: every rail below is one `homeSections` doc, ordered by `sortOrder`. See AdminMarketingPage's "Homepage" tab for the editor. */
export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { sections, loading, error } = useHomeSections()

  useSeoTags({
    title: 'SnapSpare — Auto parts, priced by the quantity you actually need',
    description:
      'Buy genuine and aftermarket auto parts in India with fitment-checked listings and quantity-slab pricing — for retail owners, mechanics, garages and fleets alike.',
    path: '/',
    jsonLd: [
      buildOrganizationJsonLd({
        name: 'SnapSpare',
        url: window.location.origin,
        logoUrl: `${window.location.origin}/icons/apple-touch-icon.png`,
      }),
    ],
  })

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
      {loading ? (
        <HomePageSkeleton />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : sections.length === 0 ? (
        <EmptyState
          title={t('home.emptyTitle')}
          description={t('home.emptyDescription')}
          actionLabel={t('home.emptyAction')}
          onAction={() => navigate('/categories')}
        />
      ) : (
        sections.map((section) => <HomeSectionRenderer key={section.id} section={section} />)
      )}
    </div>
  )
}
