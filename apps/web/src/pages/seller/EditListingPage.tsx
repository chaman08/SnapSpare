import { useNavigate, useParams } from 'react-router-dom'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { useListing } from '@/features/catalog/api/listing'
import { usePartDetail } from '@/features/catalog/api/partDetail'
import { ListingCommercialForm } from '@/features/seller-listings/components/ListingCommercialForm'

export default function EditListingPage() {
  const { listingId } = useParams<{ listingId: string }>()
  const { claims } = useAuth()
  const sellerId = claims?.sellerId
  const navigate = useNavigate()

  const listingQuery = useListing(listingId ?? '')
  const partQuery = usePartDetail(listingQuery.data?.partId)

  if (!sellerId || !listingId) return null

  if (listingQuery.isLoading || partQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (listingQuery.isError || !listingQuery.data || !partQuery.data) {
    return <ErrorState onRetry={() => listingQuery.refetch()} />
  }

  const listing = listingQuery.data
  const part = partQuery.data

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <ListingCommercialForm
        sellerId={sellerId}
        catalogPart={{
          id: part.id,
          partNumber: part.partNumber,
          name: part.name,
          brand: part.brand,
          hsnCode: part.hsnCode,
          gstRatePercent: part.gstRatePercent,
          imageUrl: part.images[0],
          categorySlug: part.categorySlug,
        }}
        existingListing={listing}
        onSaved={() => navigate('/seller/listings')}
      />
    </div>
  )
}
