import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { useSellerStaff } from '@/features/seller/api/useSellerStaff'
import { StaffInviteForm } from '@/features/seller/components/StaffInviteForm'
import { StaffList } from '@/features/seller/components/StaffList'

export default function SellerStaffPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const { staff, loading } = useSellerStaff(claims?.sellerId)
  const canManageStaff = !claims?.staffRole || (claims.permissions ?? []).includes('manage_staff')

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('sellerStaff.pageTitle')}</h1>
      {canManageStaff ? <StaffInviteForm onInvited={() => undefined} /> : null}
      <StaffList staff={staff} loading={loading} />
    </div>
  )
}
