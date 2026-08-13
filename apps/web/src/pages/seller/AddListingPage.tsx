import type { SearchCatalogPartDocument } from '@snapspare/shared'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { CatalogPartTypeahead } from '@/features/seller-listings/components/CatalogPartTypeahead'
import { ListingCommercialForm } from '@/features/seller-listings/components/ListingCommercialForm'

/** Two-step "Add listing" wizard: search/confirm a master catalogue part, then enter commercial-only fields (requirement 1). Starting from the catalogue — rather than a seller free-typing a title — is deliberate, see the standing project brief. */
export default function AddListingPage() {
  const { claims } = useAuth()
  const sellerId = claims?.sellerId
  const navigate = useNavigate()
  const [selectedPart, setSelectedPart] = useState<SearchCatalogPartDocument | null>(null)

  if (!sellerId) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {!selectedPart ? (
        <CatalogPartTypeahead
          onSelect={setSelectedPart}
          onRequestNewPart={() => navigate('/seller/part-requests/new')}
        />
      ) : (
        <ListingCommercialForm
          sellerId={sellerId}
          catalogPart={selectedPart}
          onSaved={() => navigate('/seller/listings')}
        />
      )}
    </div>
  )
}
