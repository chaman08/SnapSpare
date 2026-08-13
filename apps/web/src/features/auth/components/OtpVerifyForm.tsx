import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { mapAuthErrorToI18nKey } from '@/features/auth/api/phoneAuth'
import { useCountdown } from '@/features/auth/hooks/useCountdown'

const RESEND_SECONDS = 30

const formSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'invalid') })
type FormValues = z.infer<typeof formSchema>

interface OtpVerifyFormProps {
  phone: string
  onBack: () => void
  onVerified: () => void
}

export function OtpVerifyForm({ phone, onBack, onVerified }: OtpVerifyFormProps) {
  const { t } = useTranslation()
  const { verifyOtp, signInWithPhone } = useAuth()
  const { remaining, restart } = useCountdown(RESEND_SECONDS)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) })

  const onSubmit = handleSubmit(async ({ code }) => {
    setSubmitError(null)
    try {
      await verifyOtp(code)
      onVerified()
    } catch (error) {
      setSubmitError(t(mapAuthErrorToI18nKey(error)))
    }
  })

  const handleResend = async () => {
    setSubmitError(null)
    setResending(true)
    try {
      await signInWithPhone(phone)
      restart(RESEND_SECONDS)
    } catch (error) {
      setSubmitError(t(mapAuthErrorToI18nKey(error)))
    } finally {
      setResending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <p className="text-sm text-steel">
          {t('auth.otp.sentTo', { phone: `+91 ${phone}` })}{' '}
          <button type="button" onClick={onBack} className="font-medium text-ink underline">
            {t('auth.otp.changeNumber')}
          </button>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="code">{t('auth.otp.label')}</Label>
        <Input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder={t('auth.otp.placeholder')}
          aria-invalid={Boolean(errors.code)}
          aria-describedby={errors.code ? 'code-error' : undefined}
          className="font-mono-data tracking-[0.5em]"
          {...register('code')}
        />
        {errors.code ? (
          <p id="code-error" role="alert" className="text-sm text-alert">
            {t('auth.errors.wrongOtp')}
          </p>
        ) : null}
      </div>

      {submitError ? (
        <p role="alert" aria-live="polite" className="text-sm text-alert">
          {submitError}
        </p>
      ) : null}

      <Button type="submit" variant="cta" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('auth.otp.verify')}
      </Button>

      <button
        type="button"
        onClick={handleResend}
        disabled={remaining > 0 || resending}
        className="w-full text-center text-sm font-medium text-ink underline disabled:text-steel disabled:no-underline"
      >
        {remaining > 0 ? t('auth.otp.resendIn', { seconds: remaining }) : t('auth.otp.resend')}
      </button>
    </form>
  )
}
