import { mobileSchema } from '@snapspare/shared'
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

const formSchema = z.object({ phone: mobileSchema })
type FormValues = z.infer<typeof formSchema>

interface PhoneSignInFormProps {
  onSent: (phone: string) => void
}

export function PhoneSignInForm({ onSent }: PhoneSignInFormProps) {
  const { t } = useTranslation()
  const { signInWithPhone } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) })

  const onSubmit = handleSubmit(async ({ phone }) => {
    setSubmitError(null)
    try {
      await signInWithPhone(phone)
      onSent(phone)
    } catch (error) {
      setSubmitError(t(mapAuthErrorToI18nKey(error)))
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="phone">{t('auth.phone.label')}</Label>
        <div className="flex items-center gap-2">
          <span className="flex min-h-tap items-center rounded-[6px] border border-steel/30 px-3 font-mono-data text-base text-steel">
            +91
          </span>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={t('auth.phone.placeholder')}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
            {...register('phone')}
          />
        </div>
        {errors.phone ? (
          <p id="phone-error" role="alert" className="text-sm text-alert">
            {t('auth.errors.invalidPhone')}
          </p>
        ) : null}
      </div>

      {submitError ? (
        <p role="alert" className="text-sm text-alert">
          {submitError}
        </p>
      ) : null}

      <Button type="submit" variant="cta" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('auth.phone.sendOtp')}
      </Button>
    </form>
  )
}
