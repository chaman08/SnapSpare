import { buildBreadcrumbListJsonLd, buildPartSlugId, CATEGORY_TREE, parsePartSlugId, slugify } from '@snapspare/shared'
import { AlertTriangle, Copy } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { updateGstDisplayMode } from '@/features/auth/api/profile'
import { useReturnsConfig } from '@/features/checkout/api/useReturnsConfig'
import { logPartCoView } from '@/features/catalog/api/logPartCoView'
import { usePartDetail } from '@/features/catalog/api/partDetail'
import { useListingsForPart } from '@/features/catalog/api/useListingsForPart'
import { useOfferRatings } from '@/features/catalog/api/useOfferRatings'
import { useRelatedParts } from '@/features/catalog/api/useRelatedParts'
import { useReviewsForPart } from '@/features/catalog/api/useReviewsForPart'
import { BuyBox } from '@/features/catalog/components/BuyBox'
import { FitmentBadge } from '@/features/catalog/components/FitmentBadge'
import { FitmentTab } from '@/features/catalog/components/FitmentTab'
import { ProductDetailSkeleton } from '@/features/catalog/components/ProductDetailSkeleton'
import { ProductGallery } from '@/features/catalog/components/ProductGallery'
import { QaTab } from '@/features/catalog/components/QaTab'
import { RatingSummary } from '@/features/catalog/components/RatingSummary'
import { RelatedPartsRail } from '@/features/catalog/components/RelatedPartsRail'
import { ReviewsTab } from '@/features/catalog/components/ReviewsTab'
import { SellerComparisonStrip } from '@/features/catalog/components/SellerComparisonStrip'
import { SellerDisclosureCard } from '@/features/catalog/components/SellerDisclosureCard'
import { ShippingEstimateWidget } from '@/features/catalog/components/ShippingEstimateWidget'
import { StickyBuyBar } from '@/features/catalog/components/StickyBuyBar'
import { WarrantyReturnsTab } from '@/features/catalog/components/WarrantyReturnsTab'
import type { ScorableOffer } from '@/features/catalog/lib/bestValueScore'
import { pickBestValueListingId } from '@/features/catalog/lib/bestValueScore'
import type { GstDisplayMode } from '@/features/catalog/lib/gstDisplay'
import { isBusinessBuyerType } from '@/features/catalog/lib/gstDisplay'
import { buildProductJsonLd } from '@/features/catalog/lib/productJsonLd'
import { aggregateRatings } from '@/features/catalog/lib/ratingAggregate'
import { RfqDialog } from '@/features/rfq/components/RfqDialog'
import { GenuinePartBadge } from '@/features/trust/components/GenuinePartBadge'
import { ReportSpuriousPartDialog } from '@/features/trust/components/ReportSpuriousPartDialog'
import { VerifyAuthenticityWidget } from '@/features/trust/components/VerifyAuthenticityWidget'
import { track } from '@/lib/analytics/track'
import { useSeoTags } from '@/lib/seo/useSeoTags'
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore'

/**
 * Canonical URL: /parts/p/:partSlugId, where partSlugId is
 * `${slug}-${partId}` (see buildPartSlugId/parsePartSlugId). Also reachable
 * at the legacy nested /parts/:categorySlug/:subCategorySlug/p/:partId URL
 * (router.tsx keeps both routes pointed at this component) — only the
 * trailing partId is ever trusted for data fetching; everything else in the
 * URL is cosmetic/SEO and gets corrected via a replace-navigate once the
 * part loads, same pattern whichever route matched. A `selectedListingId`
 * (defaulted to the best-value pick) drives BuyBox/StickyBuyBar/the
 * Warranty tab; SellerComparisonStrip is how a buyer switches it.
 */
export default function ProductDetailPage() {
  const { t } = useTranslation()
  const { partSlugId, partId: legacyPartId } = useParams()
  const partId = legacyPartId ?? parsePartSlugId(partSlugId)
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [requestOpen, setRequestOpen] = useState(false)
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(undefined)
  const [qty, setQty] = useState(1)
  const [activeTab, setActiveTab] = useState('specs')
  const [reportingOpen, setReportingOpen] = useState(false)
  const [gstDisplayMode, setGstDisplayModeState] = useState<GstDisplayMode>('exclusive')
  const gstSyncedRef = useRef(false)

  const partQuery = usePartDetail(partId)
  const listingsQuery = useListingsForPart(partId)
  const ratingsQuery = useOfferRatings(partId)
  const part = partQuery.data
  const { config: returnsConfig } = useReturnsConfig()
  const nonReturnable = Boolean(
    part?.subcategorySlug && returnsConfig?.nonReturnableSubcategorySlugs.includes(part.subcategorySlug),
  )

  const offers = useMemo(() => {
    const listings = listingsQuery.data ?? []
    return [...listings].sort(
      (a, b) => (a.pricing.tiers[0]?.unitPricePaise ?? 0) - (b.pricing.tiers[0]?.unitPricePaise ?? 0),
    )
  }, [listingsQuery.data])

  const listingIds = useMemo(() => offers.map((offer) => offer.id), [offers])
  const reviewsQuery = useReviewsForPart(part?.id, listingIds)
  const relatedQuery = useRelatedParts(part?.id)
  const reviews = reviewsQuery.data ?? []

  const recommendedListingId = useMemo(() => {
    const scorable: ScorableOffer[] = offers.map((offer) => ({
      listingId: offer.id,
      unitPriceAtQty1Paise: offer.pricing.tiers[0]?.unitPricePaise ?? 0,
      ratingAvg: ratingsQuery.data?.[offer.id]?.maxRating ?? 0,
      ratingCount: ratingsQuery.data?.[offer.id]?.ratingCount ?? 0,
      deliveryEtaDays: ratingsQuery.data?.[offer.id]?.deliveryEtaDays ?? 3,
    }))
    return pickBestValueListingId(scorable)
  }, [offers, ratingsQuery.data])

  useEffect(() => {
    if (!selectedListingId && recommendedListingId) {
      setSelectedListingId(recommendedListingId)
    } else if (selectedListingId && !offers.some((offer) => offer.id === selectedListingId)) {
      setSelectedListingId(recommendedListingId)
    }
  }, [recommendedListingId, offers, selectedListingId])

  const selectedListing = offers.find((offer) => offer.id === selectedListingId)

  useEffect(() => {
    if (selectedListing) setQty(selectedListing.pricing.moq)
  }, [selectedListing])

  useEffect(() => {
    if (!gstSyncedRef.current && profile) {
      setGstDisplayModeState(profile.gstDisplayMode ?? 'exclusive')
      gstSyncedRef.current = true
    }
  }, [profile])

  function handleGstDisplayModeChange(mode: GstDisplayMode) {
    setGstDisplayModeState(mode)
    if (user) {
      void updateGstDisplayMode(user.uid, mode).catch(() => toast.error(t('common.somethingWentWrong')))
    }
  }

  useEffect(() => {
    if (part) logPartCoView(part.id)
  }, [part])

  const addViewed = useRecentlyViewedStore((state) => state.addViewed)
  useEffect(() => {
    if (selectedListing) addViewed(selectedListing.id)
  }, [selectedListing, addViewed])

  const canonicalSlugId = part ? buildPartSlugId(part.slug ?? slugify(part.name), part.id) : null
  const canonicalPath = canonicalSlugId ? `/parts/p/${canonicalSlugId}` : null

  useEffect(() => {
    if (!canonicalPath) return
    if (`${window.location.pathname}` !== canonicalPath) {
      navigate(canonicalPath, { replace: true })
    }
  }, [canonicalPath, navigate])

  const seoCategory = part ? CATEGORY_TREE.find((c) => c.slug === part.categorySlug) : undefined
  const seoSubCategory = part?.subcategorySlug
    ? seoCategory?.subcategories.find((s) => s.slug === part.subcategorySlug)
    : undefined
  const canonicalUrl = canonicalPath ? `${window.location.origin}${canonicalPath}` : null
  const ratingAggregate = aggregateRatings(reviews)
  const productJsonLd = part
    ? buildProductJsonLd({
        part,
        canonicalUrl: canonicalUrl ?? '',
        offers,
        aggregateRating:
          ratingAggregate.count > 0
            ? { ratingValue: ratingAggregate.average, reviewCount: ratingAggregate.count }
            : undefined,
      })
    : null
  const breadcrumbJsonLd =
    part && canonicalUrl
      ? buildBreadcrumbListJsonLd([
          { name: t('nav.categories'), url: `${window.location.origin}/categories` },
          ...(seoCategory ? [{ name: seoCategory.name, url: `${window.location.origin}/parts/${seoCategory.slug}` }] : []),
          ...(seoSubCategory
            ? [{ name: seoSubCategory.name, url: `${window.location.origin}/parts/${seoCategory!.slug}/${seoSubCategory.slug}` }]
            : []),
          { name: part.name, url: canonicalUrl },
        ])
      : null

  useSeoTags({
    title: part ? `${part.name} — SnapSpare` : 'SnapSpare',
    description: part?.description ?? (part ? `${part.name} (${part.partNumber}) — compare prices across verified sellers on SnapSpare.` : undefined),
    path: canonicalPath ?? window.location.pathname,
    ogImage: part?.images[0] ?? offers[0]?.images?.[0],
    ogType: 'product',
    jsonLd: [productJsonLd, breadcrumbJsonLd],
  })

  useEffect(() => {
    if (part) {
      track('view_item', {
        currency: 'INR',
        value: (offers[0]?.pricing.tiers[0]?.unitPricePaise ?? 0) / 100,
        items: [
          {
            item_id: part.id,
            item_name: part.name,
            item_category: part.categorySlug,
            item_category2: part.subcategorySlug,
            item_brand: part.brand,
            price: (offers[0]?.pricing.tiers[0]?.unitPricePaise ?? 0) / 100,
          },
        ],
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per part id, not on every offers re-sort
  }, [part?.id])

  if (partQuery.isLoading || listingsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <ProductDetailSkeleton />
      </div>
    )
  }

  if (!part) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <EmptyState
          title={partQuery.isError ? t('common.somethingWentWrong') : t('product.detail.notFoundTitle')}
          description={partQuery.isError ? undefined : t('product.detail.notFoundDescription')}
          actionLabel={partQuery.isError ? t('common.retry') : t('product.detail.browseCategories')}
          onAction={() => (partQuery.isError ? partQuery.refetch() : navigate('/categories'))}
        />
      </div>
    )
  }

  const category = CATEGORY_TREE.find((c) => c.slug === part.categorySlug)
  const subCategory = part.subcategorySlug
    ? category?.subcategories.find((s) => s.slug === part.subcategorySlug)
    : undefined
  const categoryPath = category ? `/parts/${category.slug}` : '/categories'
  const subCategoryPath =
    category && subCategory ? `/parts/${category.slug}/${subCategory.slug}` : categoryPath
  const galleryImages = part.images.length > 0 ? part.images : (offers[0]?.images ?? [])

  async function copyPartNumber() {
    try {
      await navigator.clipboard.writeText(part!.partNumber)
      toast.success(t('product.detail.copied'))
    } catch {
      toast.error(t('common.somethingWentWrong'))
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-steel">
        <Link to="/categories" className="hover:text-ink">
          {t('nav.categories')}
        </Link>
        {category ? (
          <>
            <span aria-hidden="true">/</span>
            <Link to={categoryPath} className="hover:text-ink">
              {category.name}
            </Link>
          </>
        ) : null}
        {subCategory ? (
          <>
            <span aria-hidden="true">/</span>
            <Link to={subCategoryPath} className="hover:text-ink">
              {subCategory.name}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span className="truncate text-ink">{part.name}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-2">
        <ProductGallery images={galleryImages} alt={part.name} />

        <div className="space-y-3">
          <FitmentBadge partId={part.id} size="lg" />

          <div className="flex flex-wrap items-center gap-2">
            {part.brand ? <p className="text-sm font-medium text-steel">{part.brand}</p> : null}
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink">
              {t(`search.facets.partType.${part.partType}`)}
            </span>
          </div>
          <h1 className="font-heading text-2xl font-semibold text-ink">{part.name}</h1>

          {reviewsQuery.data ? <RatingSummary reviews={reviews} variant="compact" /> : null}

          <div className="flex items-center gap-1.5">
            <p className="font-mono text-sm text-steel">
              {t('product.detail.partNumber')}: {part.partNumber}
            </p>
            <button
              type="button"
              onClick={copyPartNumber}
              aria-label={t('product.detail.copyPartNumber')}
              className="flex min-h-tap min-w-tap items-center justify-center rounded-[6px] text-steel hover:bg-surface-muted hover:text-ink"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {part.oemNumbers.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-steel">{t('product.detail.oemNumbers')}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {part.oemNumbers.map((number) => (
                  <span
                    key={number}
                    className="rounded-full bg-surface-muted px-2 py-0.5 font-mono text-xs text-ink"
                  >
                    {number}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {part.crossRefNumbers.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-steel">{t('product.detail.crossRefNumbers')}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {part.crossRefNumbers.map((number) => (
                  <span
                    key={number}
                    className="rounded-full bg-surface-muted px-2 py-0.5 font-mono text-xs text-ink"
                  >
                    {number}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={t('product.detail.noOffersTitle')}
            description={t('product.detail.noOffersDescription')}
            actionLabel={t('search.zeroResults.requestPart')}
            onAction={() => setRequestOpen(true)}
          />
        </div>
      ) : selectedListing ? (
        <>
          {nonReturnable ? (
            <div className="mb-3 flex items-start gap-2 rounded-[6px] border border-alert bg-alert/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden="true" />
              <p className="text-sm font-medium text-alert">{t('product.detail.warrantyReturns.nonReturnable')}</p>
            </div>
          ) : null}
          <BuyBox
            listing={selectedListing}
            rating={ratingsQuery.data?.[selectedListing.id]}
            buyerType={profile?.buyerType}
            showGstToggle={Boolean(user) && isBusinessBuyerType(profile?.buyerType)}
            gstDisplayMode={gstDisplayMode}
            onGstDisplayModeChange={handleGstDisplayModeChange}
            qty={qty}
            onQtyChange={setQty}
            className="mt-6"
          />

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRequestOpen(true)}
              className="min-h-tap text-sm font-medium text-signal hover:underline"
            >
              {t('rfq.form.bulkCta')}
            </button>
            {user ? (
              <button
                type="button"
                onClick={() => setReportingOpen(true)}
                className="min-h-tap text-sm font-medium text-steel hover:underline"
              >
                {t('trust.spuriousReport.action')}
              </button>
            ) : null}
          </div>

          <GenuinePartBadge badge={selectedListing.genuineBadge} />
          <VerifyAuthenticityWidget listingId={selectedListing.id} />

          {selectedListing.isOversized ? (
            <p className="mt-3 rounded-[6px] bg-surface-muted px-3 py-2 text-sm text-steel">
              {t('product.oversizedNotice')}
            </p>
          ) : null}

          <ShippingEstimateWidget
            sellerId={selectedListing.sellerId}
            weightGrams={selectedListing.weightGrams ?? 500}
            dimensionsCm={selectedListing.dimensionsCm}
            className="mt-3"
          />

          <SellerDisclosureCard sellerId={selectedListing.sellerId} countryOfOrigin={part.countryOfOrigin} />

          <div className="mt-8">
            <h2 className="mb-3 font-heading text-xl font-semibold text-ink">
              {t('product.detail.offersCount', { count: offers.length })}
            </h2>
            <SellerComparisonStrip
              listings={offers}
              ratings={ratingsQuery.data ?? {}}
              partType={part.partType}
              selectedListingId={selectedListing.id}
              onSelect={setSelectedListingId}
              recommendedListingId={recommendedListingId}
            />
          </div>

          <div className="mt-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList aria-label={t('product.detail.tabs.groupLabel')}>
                <TabsTrigger value="specs">{t('product.detail.tabs.specs')}</TabsTrigger>
                <TabsTrigger value="fitment">{t('product.detail.tabs.fitment')}</TabsTrigger>
                <TabsTrigger value="warranty">{t('product.detail.tabs.warranty')}</TabsTrigger>
                <TabsTrigger value="reviews">{t('product.detail.tabs.reviews')}</TabsTrigger>
                <TabsTrigger value="qa">{t('product.detail.tabs.qa')}</TabsTrigger>
              </TabsList>

              <TabsContent value="specs">
                <div className="space-y-4">
                  {part.description ? (
                    <p className="text-sm text-ink">{part.description}</p>
                  ) : null}
                  {Object.keys(part.attributes).length > 0 ? (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {Object.entries(part.attributes).map(([key, value]) => (
                        <div key={key} className="contents">
                          <dt className="text-steel">{key}</dt>
                          <dd className="text-ink">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-steel">{t('product.detail.noSpecifications')}</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="fitment">
                <FitmentTab partId={part.id} />
              </TabsContent>

              <TabsContent value="warranty">
                <WarrantyReturnsTab listing={selectedListing} subcategorySlug={part.subcategorySlug} />
              </TabsContent>

              <TabsContent value="reviews">
                <ReviewsTab partId={part.id} listingIds={listingIds} />
              </TabsContent>

              <TabsContent value="qa">
                <QaTab partId={part.id} />
              </TabsContent>
            </Tabs>
          </div>

          <RelatedPartsRail
            title={t('product.detail.related.boughtTogether')}
            listings={relatedQuery.data?.boughtTogether ?? []}
          />
          <RelatedPartsRail
            title={t('product.detail.related.alsoViewed')}
            listings={relatedQuery.data?.alsoViewed ?? []}
          />

          <StickyBuyBar
            listing={selectedListing}
            qty={qty}
            onQtyChange={setQty}
            gstDisplayMode={gstDisplayMode}
          />
        </>
      ) : null}

      <RfqDialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        prefillPart={{ partId: part.id, title: part.name, categorySlug: part.categorySlug }}
      />

      {reportingOpen && selectedListing ? (
        <ReportSpuriousPartDialog
          listingId={selectedListing.id}
          partId={part.id}
          sellerId={selectedListing.sellerId}
          onClose={() => setReportingOpen(false)}
        />
      ) : null}
    </div>
  )
}
