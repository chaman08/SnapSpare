import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { mapAuthErrorToI18nKey } from '@/features/auth/api/phoneAuth'

export function GoogleSignInButton() {
  const { t } = useTranslation()
  const { signInWithGoogle } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setError(null)
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(t(mapAuthErrorToI18nKey(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full" onClick={handleClick} disabled={loading}>
        {t('auth.google.signIn')}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
