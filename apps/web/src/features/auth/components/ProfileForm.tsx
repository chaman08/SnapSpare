import { type BuyerType, buyerTypeSchema, gstinSchema, type User } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateBuyerProfile } from '@/features/auth/api/profile'
import { verifyGstin } from '@/features/auth/api/verifyGstin'
import i18n from '@/lib/i18n'
import { SUPPORTED_LOCALES } from '@/i18n/locales'

const formSchema = z.object({
  displayName: z.string().min(1),
  email: z.union([z.string().email(), z.literal('')]),
  preferredLanguage: z.enum(['en', 'hi']),
  buyerType: buyerTypeSchema,
  gstin: z.union([gstinSchema, z.literal('')]),
})
type FormValues = z.infer<typeof formSchema>

const BUYER_TYPES: BuyerType[] = ['retail', 'mechanic', 'garage', 'fleet', 'reseller']

export function ProfileForm({ profile }: { profile: User }) {
  const { t } = useTranslation()
  const [gstinStatus, setGstinStatus] = useState<'idle' | 'checking' | 'pending' | 'invalid'>('idle')
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: profile.displayName,
      email: profile.email ?? '',
      preferredLanguage: profile.preferredLanguage,
      buyerType: profile.buyerType ?? 'retail',
      gstin: profile.gstin ?? '',
    },
  })
  const selectedBuyerType = watch('buyerType')
  const gstinValue = watch('gstin')

  const onSubmit = handleSubmit(async (values) => {
    await updateBuyerProfile(profile.id, values)
    void i18n.changeLanguage(values.preferredLanguage)
    toast.success(t('auth.profile.saved'))
  })

  const handleVerifyGstin = async () => {
    setGstinStatus('checking')
    try {
      const result = await verifyGstin(gstinValue)
      setGstinStatus(result.status)
    } catch {
      setGstinStatus('invalid')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="displayName">{t('auth.profile.name')}</Label>
        <Input id="displayName" {...register('displayName')} />
        {errors.displayName ? (
          <p role="alert" className="text-sm text-alert">
            {t('auth.profile.nameRequired')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">{t('auth.profile.email')}</Label>
        <Input id="email" type="email" {...register('email')} />
        {errors.email ? (
          <p role="alert" className="text-sm text-alert">
            {t('auth.profile.emailInvalid')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="preferredLanguage">{t('auth.profile.language')}</Label>
        <select
          id="preferredLanguage"
          className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          {...register('preferredLanguage')}
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <option key={locale.code} value={locale.code}>
              {locale.nativeLabel}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="buyerType">{t('auth.profile.buyerType')}</Label>
        <select
          id="buyerType"
          className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          {...register('buyerType')}
        >
          {BUYER_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`auth.buyerType.${type}`)}
            </option>
          ))}
        </select>
        <p className="text-sm text-steel">{t(`auth.buyerType.explainer.${selectedBuyerType}`)}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gstin">{t('auth.profile.gstin')}</Label>
        <div className="flex gap-2">
          <Input
            id="gstin"
            className="font-mono-data uppercase"
            maxLength={15}
            {...register('gstin', {
              onChange: () => setGstinStatus('idle'),
            })}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleVerifyGstin}
            disabled={!gstinValue || gstinStatus === 'checking'}
          >
            {t('auth.profile.verify')}
          </Button>
        </div>
        {errors.gstin ? (
          <p role="alert" className="text-sm text-alert">
            {t('auth.profile.gstinInvalid')}
          </p>
        ) : null}
        {gstinStatus === 'pending' ? (
          <p className="text-sm text-verify">{t('auth.profile.verifyPending')}</p>
        ) : null}
        {gstinStatus === 'invalid' ? (
          <p role="alert" className="text-sm text-alert">
            {t('auth.profile.verifyInvalid')}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="cta" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('auth.profile.save')}
      </Button>
    </form>
  )
}
