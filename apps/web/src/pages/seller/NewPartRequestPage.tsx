import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { PartRequestForm } from '@/features/seller-listings/components/PartRequestForm'

export default function NewPartRequestPage() {
  const { claims } = useAuth()
  const sellerId = claims?.sellerId
  const navigate = useNavigate()

  if (!sellerId) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <PartRequestForm sellerId={sellerId} onSubmitted={() => navigate('/seller/part-requests')} />
    </div>
  )
}
