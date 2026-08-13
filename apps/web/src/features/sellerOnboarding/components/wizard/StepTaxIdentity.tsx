import type { SellerApplication } from '@snapspare/shared'
import { gstinSchema, panSchema } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { verifyGstin } from '@/features/auth/api/verifyGstin'
import { saveSellerApplicationStep } from '@/features/sellerOnboarding/api/sellerApplication'
import { StepFooter } from '@/features/sellerOnboarding/components/wizard/StepFooter'

const formSchema = z
  .object({
    gstRegistered: z.boolean(),
    gstin: z.union([gstinSchema, z.literal('')]),
    pan: panSchema,
    gstComposition: z.boolean(),
    turnoverMode: z.enum(['unregistered_below_threshold', 'unregistered_intrastate_only']).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.gstRegistered && !value.gstin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gstin'], message: 'required' })
    }
  })
type FormValues = z.infer<typeof formSchema>

interface StepTaxIdentityProps {
  uid: string
  status: SellerApplication['status'] | undefined
  initial: SellerApplication['taxIdentity'] | undefined
  onSaved: () => void
  onBack: () => void
}

export function StepTaxIdentity({ uid, status, initial, onSaved, onBack }: StepTaxIdentityProps) {
  const { t } = useTranslation()
  const [gstinCheck, setGstinCheck] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gstRegistered: initial?.gstRegistered ?? true,
      gstin: initial?.gstin ?? '',
      pan: initial?.pan ?? '',
      gstComposition: initial?.gstComposition ?? false,
      turnoverMode: initial?.turnoverMode,
    },
  })

  const gstRegistered = watch('gstRegistered')

  async function handleGstinBlur() {
    const value = watch('gstin')
    if (!gstinSchema.safeParse(value).success) return
    setGstinCheck('checking')
    const result = await verifyGstin(value)
    setGstinCheck(result.status === 'pending' ? 'valid' : 'invalid')
  }

  const submit = handleSubmit(async (values) => {
    await saveSellerApplicationStep(uid, status, {
      currentStep: 3,
      taxIdentity: {
        gstRegistered: values.gstRegistered,
        gstin: values.gstRegistered ? (values.gstin || undefined) : undefined,
        pan: values.pan,
        gstComposition: values.gstRegistered ? values.gstComposition : false,
        turnoverMode: values.gstRegistered ? undefined : values.turnoverMode,
      },
    })
    onSaved()
  })

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="flex gap-2 rounded-[6px] border border-steel/20 p-1">
        <button
          type="button"
          onClick={() => setValue('gstRegistered', true)}
          className={`min-h-tap flex-1 rounded-[4px] text-sm font-medium ${gstRegistered ? 'bg-ink text-surface' : 'text-steel'}`}
        >
          {t('sell.wizard.tax.gstRegisteredYes')}
        </button>
        <button
          type="button"
          onClick={() => setValue('gstRegistered', false)}
          className={`min-h-tap flex-1 rounded-[4px] text-sm font-medium ${!gstRegistered ? 'bg-ink text-surface' : 'text-steel'}`}
        >
          {t('sell.wizard.tax.gstRegisteredNo')}
        </button>
      </div>

      {gstRegistered ? (
        <div className="space-y-1.5">
          <Label htmlFor="gstin">{t('sell.wizard.tax.gstin')}</Label>
          <Input
            id="gstin"
            className="font-mono-data uppercase"
            maxLength={15}
            {...register('gstin', { onBlur: handleGstinBlur })}
          />
          {errors.gstin ? (
            <p role="alert" className="text-sm text-alert">
              {t('sell.wizard.tax.gstinInvalid')}
            </p>
          ) : null}
          {gstinCheck === 'checking' ? <p className="text-xs text-steel">{t('common.loading')}</p> : null}
          {gstinCheck === 'valid' ? <p className="text-xs text-verify">{t('sell.wizard.tax.gstinFormatOk')}</p> : null}
          {gstinCheck === 'invalid' ? <p className="text-xs text-alert">{t('sell.wizard.tax.gstinInvalid')}</p> : null}

          <label className="mt-2 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="h-4 w-4 accent-signal" {...register('gstComposition')} />
            {t('sell.wizard.tax.gstComposition')}
          </label>
        </div>
      ) : (
        <div className="space-y-3 rounded-[6px] border border-alert/30 bg-alert/5 p-3">
          <p className="inline-flex items-start gap-2 text-sm text-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden="true" />
            {t('sell.wizard.tax.unregisteredWarning')}
          </p>
          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                className="mt-1 h-4 w-4 accent-signal"
                value="unregistered_below_threshold"
                checked={watch('turnoverMode') === 'unregistered_below_threshold'}
                onChange={() => setValue('turnoverMode', 'unregistered_below_threshold')}
              />
              {t('sell.wizard.tax.turnoverModeBelowThreshold')}
            </label>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                className="mt-1 h-4 w-4 accent-signal"
                value="unregistered_intrastate_only"
                checked={watch('turnoverMode') === 'unregistered_intrastate_only'}
                onChange={() => setValue('turnoverMode', 'unregistered_intrastate_only')}
              />
              {t('sell.wizard.tax.turnoverModeIntrastateOnly')}
            </label>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="pan">{t('sell.wizard.tax.pan')}</Label>
        <Input id="pan" className="font-mono-data uppercase" maxLength={10} {...register('pan')} />
        {errors.pan ? (
          <p role="alert" className="text-sm text-alert">
            {t('sell.wizard.tax.panInvalid')}
          </p>
        ) : null}
      </div>

      <StepFooter onBack={onBack} isSubmitting={isSubmitting} />
    </form>
  )
}
