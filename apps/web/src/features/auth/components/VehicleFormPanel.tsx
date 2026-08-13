import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GarageVehicleInput } from '@/features/auth/api/garageVehicles'
import {
  useVehicleMakes,
  useVehicleModels,
  useVehicleVariants,
} from '@/features/auth/api/vehicleCatalog'

interface VehicleFormPanelProps {
  onSubmit: (input: GarageVehicleInput) => Promise<void>
  onCancel: () => void
  /** Pre-fills the cascading selects, e.g. from a registration-number lookup guess the buyer still needs to confirm or correct. */
  initial?: Partial<GarageVehicleInput>
  /** Shown above the form, e.g. "Resolved from your registration number — please confirm." */
  note?: string
}

const selectClassName =
  'flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-50'

export function VehicleFormPanel({ onSubmit, onCancel, initial, note }: VehicleFormPanelProps) {
  const { t } = useTranslation()
  const [makeId, setMakeId] = useState(initial?.makeId ?? '')
  const [modelId, setModelId] = useState(initial?.modelId ?? '')
  const [variantId, setVariantId] = useState(initial?.variantId ?? '')
  const [year, setYear] = useState(initial?.year ? String(initial.year) : '')
  const [nickname, setNickname] = useState(initial?.nickname ?? '')
  const [submitting, setSubmitting] = useState(false)

  const makesQuery = useVehicleMakes()
  const modelsQuery = useVehicleModels(makeId || undefined)
  const variantsQuery = useVehicleVariants(makeId || undefined, modelId || undefined)

  const selectedVariant = useMemo(
    () => variantsQuery.data?.find((v) => v.id === variantId),
    [variantsQuery.data, variantId],
  )

  const yearOptions = useMemo(() => {
    if (!selectedVariant) return []
    const from = selectedVariant.yearFrom
    const to = selectedVariant.yearTo ?? new Date().getFullYear()
    const years: number[] = []
    for (let y = to; y >= from; y--) years.push(y)
    return years
  }, [selectedVariant])

  const canSubmit = Boolean(makeId && modelId && variantId && year)

  const handleSubmit = async () => {
    const make = makesQuery.data?.find((m) => m.id === makeId)
    const model = modelsQuery.data?.find((m) => m.id === modelId)
    if (!make || !model || !selectedVariant || !canSubmit) return

    setSubmitting(true)
    try {
      await onSubmit({
        makeId,
        makeName: make.name,
        modelId,
        modelName: model.name,
        variantId,
        variantName: selectedVariant.name,
        fuelType: selectedVariant.fuelType,
        year: Number(year),
        nickname: nickname || undefined,
        registrationNumber: initial?.registrationNumber,
        odometerKm: initial?.odometerKm,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-[6px] border border-steel/20 p-4">
      {note ? (
        <p className="rounded-[6px] bg-surface-muted px-3 py-2 text-sm text-steel">{note}</p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="make">{t('garage.form.make')}</Label>
        <select
          id="make"
          className={selectClassName}
          value={makeId}
          onChange={(e) => {
            setMakeId(e.target.value)
            setModelId('')
            setVariantId('')
            setYear('')
          }}
        >
          <option value="">{t('garage.form.select')}</option>
          {makesQuery.data?.map((make) => (
            <option key={make.id} value={make.id}>
              {make.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="model">{t('garage.form.model')}</Label>
        <select
          id="model"
          className={selectClassName}
          value={modelId}
          disabled={!makeId}
          onChange={(e) => {
            setModelId(e.target.value)
            setVariantId('')
            setYear('')
          }}
        >
          <option value="">{t('garage.form.select')}</option>
          {modelsQuery.data?.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="variant">{t('garage.form.variant')}</Label>
        <select
          id="variant"
          className={selectClassName}
          value={variantId}
          disabled={!modelId}
          onChange={(e) => {
            setVariantId(e.target.value)
            setYear('')
          }}
        >
          <option value="">{t('garage.form.select')}</option>
          {variantsQuery.data?.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="year">{t('garage.form.year')}</Label>
          <select
            id="year"
            className={selectClassName}
            value={year}
            disabled={!variantId}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="">{t('garage.form.select')}</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fuel">{t('garage.form.fuel')}</Label>
          <Input
            id="fuel"
            readOnly
            value={selectedVariant ? t(`garage.fuelType.${selectedVariant.fuelType}`) : ''}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nickname">{t('garage.form.nickname')}</Label>
        <Input
          id="nickname"
          placeholder={t('garage.form.nicknamePlaceholder')}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="cta" disabled={!canSubmit || submitting} onClick={handleSubmit}>
          {submitting ? t('common.loading') : t('garage.form.save')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('garage.form.cancel')}
        </Button>
      </div>
    </div>
  )
}
