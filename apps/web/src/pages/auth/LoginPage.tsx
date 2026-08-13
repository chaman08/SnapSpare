import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton'
import { OtpVerifyForm } from '@/features/auth/components/OtpVerifyForm'
import { PhoneSignInForm } from '@/features/auth/components/PhoneSignInForm'
import { RECAPTCHA_CONTAINER_ID } from '@/features/auth/api/phoneAuth'

type Step = 'phone' | 'otp'

export default function LoginPage() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!loading && user) navigate(redirect, { replace: true })
  }, [loading, user, redirect, navigate])

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-1 font-heading text-2xl font-semibold text-ink">{t('auth.login.title')}</h1>
      <p className="mb-6 text-sm text-steel">{t('auth.login.subtitle')}</p>

      {step === 'phone' ? (
        <>
          <PhoneSignInForm
            onSent={(sentPhone) => {
              setPhone(sentPhone)
              setStep('otp')
            }}
          />
          <div className="my-6 flex items-center gap-3 text-xs text-steel">
            <span className="h-px flex-1 bg-steel/20" />
            {t('auth.login.or')}
            <span className="h-px flex-1 bg-steel/20" />
          </div>
          <GoogleSignInButton />
        </>
      ) : (
        <OtpVerifyForm
          phone={phone}
          onBack={() => setStep('phone')}
          onVerified={() => navigate(redirect, { replace: true })}
        />
      )}

      {/* Invisible reCAPTCHA anchor required by signInWithPhoneNumber. */}
      <div id={RECAPTCHA_CONTAINER_ID} />
    </div>
  )
}
