import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/states/EmptyState'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { AddressList } from '@/features/auth/components/AddressList'
import { LowDataModeToggle } from '@/features/auth/components/LowDataModeToggle'
import { ProfileForm } from '@/features/auth/components/ProfileForm'
import { NotificationPreferencesForm } from '@/features/notifications/components/NotificationPreferencesForm'

export default function AccountPage() {
  const { t } = useTranslation()
  const { user, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
        <EmptyState
          title={t('auth.account.signInTitle')}
          actionLabel={t('auth.account.signIn')}
          onAction={() => {
            window.location.href = '/login?redirect=%2Faccount'
          }}
        />
        <section>
          <h2 className="mb-4 font-heading text-xl font-semibold text-ink">{t('preferences.title')}</h2>
          <LowDataModeToggle />
        </section>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
      <section>
        <h1 className="mb-4 font-heading text-2xl font-semibold text-ink">{t('auth.profile.title')}</h1>
        <ProfileForm profile={profile} />
      </section>

      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold text-ink">{t('address.title')}</h2>
        <AddressList userId={user.uid} />
      </section>

      <NotificationPreferencesForm />

      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold text-ink">{t('preferences.title')}</h2>
        <LowDataModeToggle />
      </section>

      <Button variant="outline" onClick={() => void signOut()}>
        {t('auth.profile.signOut')}
      </Button>
    </div>
  )
}
