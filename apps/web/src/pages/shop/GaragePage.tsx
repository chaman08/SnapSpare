import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { GarageList } from '@/features/auth/components/GarageList'

function GaragePageContent() {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 font-heading text-2xl font-semibold text-ink">{t('garage.title')}</h1>
      <GarageList userId={user.uid} />
    </div>
  )
}

export default function GaragePage() {
  return (
    <RequireAuth>
      <GaragePageContent />
    </RequireAuth>
  )
}
