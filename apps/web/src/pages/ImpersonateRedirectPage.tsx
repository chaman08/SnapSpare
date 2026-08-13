import { signInWithCustomToken } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states/ErrorState'
import { auth } from '@/lib/firebase'

/**
 * Users module impersonation landing page (design brief item 11). Opened in
 * a fresh tab by the admin console with the custom token in the URL
 * fragment (never the query string or path, so it never reaches the
 * server/analytics) — signs in as the target user, then redirects home.
 * Public route (no RequireAuth/RequireRole): the whole point is to become
 * signed-in-as-someone-else, so it can't require being already signed in
 * as that someone.
 */
export default function ImpersonateRedirectPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [error, setError] = useState(false)

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')
    if (!token) {
      setError(true)
      return
    }
    signInWithCustomToken(auth, token)
      .then(() => navigate('/', { replace: true }))
      .catch(() => setError(true))
  }, [navigate])

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ErrorState onRetry={() => window.location.reload()} message={t('admin.users.impersonateFailed')} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-3 px-4 py-16">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}
