import type { SearchListingDocument } from '@snapspare/shared'
import { ProductCard } from '@/features/catalog/components/ProductCard'

interface RelatedPartsRailProps {
  title: string
  listings: SearchListingDocument[]
}

/** Horizontally-scrolling rail of ProductCard tiles — shared by "Frequently bought together" and "Others also viewed"; renders nothing when there's no co-occurrence signal yet (a brand-new part, say), rather than an empty section. */
export function RelatedPartsRail({ title, listings }: RelatedPartsRailProps) {
  if (listings.length === 0) return null

  return (
    <section aria-label={title} className="mt-8">
      <h2 className="mb-3 font-heading text-xl font-semibold text-ink">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {listings.map((listing) => (
          <ProductCard key={listing.listingId} listing={listing} className="w-44 shrink-0 sm:w-52" />
        ))}
      </div>
    </section>
  )
}
