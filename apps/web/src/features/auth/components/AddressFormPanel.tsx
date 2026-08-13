import type { Address } from '@snapspare/shared'
import { gstinSchema, mobileSchema, pincodeSchema, stateCodeSchema } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { type FocusEvent, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AddressInput } from '@/features/auth/api/addresses'
import { lookupPincode } from '@/features/auth/api/pincodeLookup'

const formSchema = z.object({
  label: z.string().min(1),
  contactName: z.string().min(1),
  contactPhone: mobileSchema,
  line1: z.string().min(1),
  line2: z.string(),
  landmark: z.string(),
  pincode: pincodeSchema,
  city: z.string().min(1),
  state: z.string().min(1),
  stateCode: stateCodeSchema,
  gstin: z.union([gstinSchema, z.literal('')]),
})
type FormValues = z.infer<typeof formSchema>

interface AddressFormPanelProps {
  initial?: Address
  onSubmit: (input: AddressInput) => Promise<void>
  onCancel: () => void
}

export function AddressFormPanel({ initial, onSubmit, onCancel }: AddressFormPanelProps) {
  const { t } = useTranslation()
  const [pincodeLookupState, setPincodeLookupState] = useState<'idle' | 'checking' | 'notFound'>('idle')
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: initial?.label ?? '',
      contactName: initial?.contactName ?? '',
      contactPhone: initial?.contactPhone ?? '',
      line1: initial?.line1 ?? '',
      line2: initial?.line2 ?? '',
      landmark: initial?.landmark ?? '',
      pincode: initial?.pincode ?? '',
      city: initial?.city ?? '',
      state: initial?.state ?? '',
      stateCode: initial?.stateCode ?? '',
      gstin: initial?.gstin ?? '',
    },
  })

  const handlePincodeBlur = async (event: FocusEvent<HTMLInputElement>) => {
    const pincode = event.target.value
    if (!/^[1-9][0-9]{5}$/.test(pincode)) return
    setPincodeLookupState('checking')
    const result = await lookupPincode(pincode)
    if (result) {
      setValue('city', result.city, { shouldValidate: true })
      setValue('state', result.state, { shouldValidate: true })
      setValue('stateCode', result.stateCode, { shouldValidate: true })
      setPincodeLookupState('idle')
    } else {
      setPincodeLookupState('notFound')
    }
  }

  const submit = handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[6px] border border-steel/20 p-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="label">{t('address.form.label')}</Label>
          <Input id="label" placeholder={t('address.form.labelPlaceholder')} {...register('label')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">{t('address.form.contactName')}</Label>
          <Input id="contactName" {...register('contactName')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contactPhone">{t('address.form.contactPhone')}</Label>
        <Input id="contactPhone" inputMode="numeric" {...register('contactPhone')} />
        {errors.contactPhone ? (
          <p role="alert" className="text-sm text-alert">
            {t('auth.errors.invalidPhone')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="line1">{t('address.form.line1')}</Label>
        <Input id="line1" {...register('line1')} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="line2">{t('address.form.line2')}</Label>
          <Input id="line2" {...register('line2')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="landmark">{t('address.form.landmark')}</Label>
          <Input id="landmark" {...register('landmark')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pincode">{t('address.form.pincode')}</Label>
        <Input
          id="pincode"
          inputMode="numeric"
          maxLength={6}
          {...register('pincode', { onBlur: handlePincodeBlur })}
        />
        {pincodeLookupState === 'checking' ? (
          <p className="text-sm text-steel">{t('address.form.pincodeChecking')}</p>
        ) : null}
        {pincodeLookupState === 'notFound' ? (
          <p className="text-sm text-steel">{t('address.form.pincodeNotFound')}</p>
        ) : null}
        {errors.pincode ? (
          <p role="alert" className="text-sm text-alert">
            {t('address.form.pincodeInvalid')}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="city">{t('address.form.city')}</Label>
          <Input id="city" {...register('city')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="state">{t('address.form.state')}</Label>
          <Input id="state" {...register('state')} readOnly />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gstin">{t('address.form.gstin')}</Label>
        <Input id="gstin" className="font-mono-data uppercase" maxLength={15} {...register('gstin')} />
        {errors.gstin ? (
          <p role="alert" className="text-sm text-alert">
            {t('auth.profile.gstinInvalid')}
          </p>
        ) : null}
      </div>

      <input type="hidden" {...register('stateCode')} />

      <div className="flex gap-2">
        <Button type="submit" variant="cta" disabled={isSubmitting}>
          {isSubmitting ? t('common.loading') : t('address.form.save')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('address.form.cancel')}
        </Button>
      </div>
    </form>
  )
}
