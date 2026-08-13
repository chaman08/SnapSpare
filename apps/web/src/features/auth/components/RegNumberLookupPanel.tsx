import { type VehicleRegLookupResult, vehicleRegistrationSchema } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { lookupVehicleByReg, mapVehicleRegLookupErrorToI18nKey } from '@/features/auth/api/vehicleRegLookup'

const formSchema = z.object({ regNumber: vehicleRegistrationSchema })
type FormValues = z.infer<typeof formSchema>

interface RegNumberLookupPanelProps {
  onResolved: (result: VehicleRegLookupResult) => void
  onCancel: () => void
}

/**
 * Step 1 of the registration-number flow: resolve a plate to a vehicle
 * guess. The guess is never saved directly — `onResolved` hands it to
 * AddVehicleFlow, which renders it pre-filled in the normal VehicleFormPanel
 * for the buyer to confirm or correct before anything is written.
 */
export function RegNumberLookupPanel({ onResolved, onCancel }: RegNumberLookupPanelProps) {
  const { t } = useTranslation()
  const [requestError, setRequestError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) })

  const submit = handleSubmit(async ({ regNumber }) => {
    setRequestError(null)
    setNotFound(false)
    try {
      const result = await lookupVehicleByReg(regNumber)
      if (!result.found) {
        setNotFound(true)
        return
      }
      onResolved(result)
    } catch (err) {
      setRequestError(t(mapVehicleRegLookupErrorToI18nKey(err)))
    }
  })

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="regNumber">{t('vehicleRegLookup.label')}</Label>
        <Input
          id="regNumber"
          className="font-mono uppercase tracking-wider"
          placeholder={t('vehicleRegLookup.placeholder')}
          autoCapitalize="characters"
          aria-invalid={Boolean(errors.regNumber)}
          aria-describedby={errors.regNumber ? 'regNumber-error' : undefined}
          {...register('regNumber')}
        />
        <p className="text-sm text-steel">{t('vehicleRegLookup.hint')}</p>
        {errors.regNumber ? (
          <p id="regNumber-error" role="alert" className="text-sm text-alert">
            {t('vehicleRegLookup.invalidFormat')}
          </p>
        ) : null}
      </div>

      {notFound ? (
        <p role="alert" aria-live="polite" className="text-sm text-alert">
          {t('vehicleRegLookup.notFound')}
        </p>
      ) : null}

      {requestError ? (
        <p role="alert" aria-live="polite" className="text-sm text-alert">
          {requestError}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" variant="cta" disabled={isSubmitting}>
          {isSubmitting ? t('common.loading') : t('vehicleRegLookup.lookup')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('garage.form.cancel')}
        </Button>
      </div>
    </form>
  )
}
